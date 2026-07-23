import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import type { CurrentIdentity } from "@/lib/auth";
import { createDatasetStoragePath } from "@/lib/dataset-storage";
import { publishPreparedDataset } from "@/lib/datasets";
import {
  deletePipelineDatasetBlob,
  uploadPipelineDatasetBlob,
} from "@/lib/pipeline-products/storage";
import {
  getActiveReferenceResource,
  getReferenceResourceVersion,
} from "@/lib/reference-resources";
import {
  COUNTRY_RESOURCE_KEY,
  ROP_RESOURCE_KEY,
} from "@/lib/reference-resources/types";
import {
  SOURCE_ALIASES_RESOURCE_KEY,
  sourceAliasResourceSchema,
} from "@/lib/reference-resources/pipeline-types";

import { checksumIdentityValue, prepareAxIdentityArtifacts } from "./artifacts";
import { inspectLegacyIdentitySnapshots } from "./importer";
import { reconcileAxIdentity } from "./reconcile";
import {
  AX_IDENTITY_RULES_CHECKSUM,
  AxIdentityRuleError,
  buildAxIdentityCodes,
  isStructurallyValidAxCode,
  normalizeIso3,
  normalizeRop1,
  normalizeRop3,
  normalizeSourceInitials,
} from "./rules";
import {
  deleteAxIdentityArtifacts,
  readAxIdentityArtifact,
  uploadAxIdentityArtifact,
} from "./storage";
import {
  AX_IDENTITY_NAMESPACE,
  AX_IDENTITY_RULES_VERSION,
  type AxIdentityArtifactKind,
  type AxIdentityCandidateRow,
  type AxIdentityFinding,
  type AxIdentityPublicationResult,
  type LegacyIdentitySnapshot,
} from "./types";
import {
  getAxIdentityRun,
  getCurrentIdentityPublication,
  getPipelinePublication,
  getPipelinePublicationRows,
  listActiveIdentityBindings,
  listAxIdentityRuns,
  listIdentityRegistryRevisions,
} from "./repository";

type Db = ReturnType<typeof getDb>;
type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

const AX_IDENTITY_PUBLICATION_LEASE_MS = 15 * 60 * 1_000;

export class AxIdentityRegistryError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "AxIdentityRegistryError";
  }
}

export function getAxIdentityPublicationTargetKey(sourceProfileKey: string) {
  const target = `identity-${sourceProfileKey}`;
  if (!/^[a-z][a-z0-9-]*$/u.test(target)) {
    throw new AxIdentityRegistryError(
      "The source profile cannot be used as an identity publication target.",
      409,
    );
  }
  return target;
}

export function assertExpectedIdentityPublication(input: {
  expectedCurrentPublicationId: string | null;
  currentPublicationId: string | null;
}) {
  if (input.expectedCurrentPublicationId !== input.currentPublicationId) {
    throw new AxIdentityRegistryError(
      "A newer identity publication now owns this source target. Rebuild the candidate before publishing.",
      409,
    );
  }
}

export function assertLegacyRegistryCutover(input: {
  cutoverRevisionNumber: number | null | undefined;
  baseRevisionId: string | null | undefined;
  baseRevisionNumber: number | null | undefined;
}) {
  if (input.cutoverRevisionNumber == null) {
    throw new AxIdentityRegistryError(
      "Legacy AX registry cutover is required before new identity allocation can begin.",
      409,
    );
  }
  if (input.baseRevisionId == null) {
    throw new AxIdentityRegistryError(
      "An exact post-cutover AX registry revision is required for identity allocation.",
      409,
    );
  }
  if (
    input.baseRevisionNumber == null ||
    input.baseRevisionNumber < input.cutoverRevisionNumber
  ) {
    throw new AxIdentityRegistryError(
      "The selected AX registry revision predates the committed legacy cutover.",
      409,
    );
  }
}

function textField(row: Record<string, string>, keys: readonly string[]) {
  for (const key of keys) {
    const value = row[key]?.trim();
    if (value) return value;
  }
  return null;
}

function errorFinding(input: {
  ruleCode: string;
  sourceRowIndex: number;
  stableRowKey: string | null;
  message: string;
  details?: Record<string, unknown>;
}): AxIdentityFinding {
  return {
    severity: "error",
    ruleCode: input.ruleCode,
    sourceRowIndex: input.sourceRowIndex,
    stableRowKey: input.stableRowKey,
    message: input.message,
    details: input.details ?? {},
  };
}

type CurrentBinding = {
  binding_id: string;
  identity_id: string;
  pgac_code: string;
  pgic_code: string;
  binding_state: "reserved" | "active";
};

async function currentBinding(
  tx: DbTransaction,
  sourceProfileKey: string,
  stableRowKey: string,
  identityRunId: string,
  baseRevisionId: string | null,
) {
  const rows = (await tx.execute(sql<CurrentBinding>`
    select binding.id as binding_id, binding.identity_id,
      parent_code.code as pgac_code, child_code.code as pgic_code,
      binding.binding_state
    from private.ax_identity_source_bindings as binding
    join private.ax_identities as child on child.id = binding.identity_id
    join private.ax_identities as parent on parent.id = child.parent_identity_id
    join private.ax_identity_codes as parent_code
      on parent_code.identity_id = parent.id and parent_code.code_kind = 'canonical'
        and parent_code.lifecycle_state in ('reserved', 'active')
    join private.ax_identity_codes as child_code
      on child_code.identity_id = child.id and child_code.code_kind = 'canonical'
        and child_code.lifecycle_state in ('reserved', 'active')
    where binding.source_profile_key = ${sourceProfileKey}
      and binding.stable_row_key = ${stableRowKey}
      and (
        (binding.binding_state = 'reserved'
          and binding.identity_run_id = ${identityRunId}::uuid)
        or (
          binding.binding_state = 'active'
          and ${baseRevisionId}::uuid is not null
          and exists (
            select 1 from private.ax_registry_revision_bindings as revision_binding
            where revision_binding.revision_id = ${baseRevisionId}::uuid
              and revision_binding.binding_id = binding.id
          )
        )
      )
    limit 1
  `)) as unknown as CurrentBinding[];
  return rows[0] ?? null;
}

async function occupiedCodeOwners(tx: DbTransaction, codes: readonly string[]) {
  if (codes.length === 0) return new Map<string, string>();
  const rows = (await tx.execute(sql<{ code: string; owner: string }>`
    select code.code, coalesce(binding.source_profile_key || ':' || binding.stable_row_key, code.identity_id::text) as owner
    from private.ax_identity_codes as code
    left join private.ax_identity_source_bindings as binding
      on binding.identity_id = code.identity_id and binding.binding_state in ('reserved', 'active')
    where code.code = any(${codes}::text[])
      and code.lifecycle_state in ('reserved', 'active')
  `)) as unknown as { code: string; owner: string }[];
  return new Map(rows.map((row) => [row.code, row.owner]));
}

async function reserveExplicitIdentity(
  tx: DbTransaction,
  input: {
    runId: string;
    sourceProfileKey: string;
    stableRowKey: string;
    pgacCode: string;
    pgicCode: string;
    aliases: readonly string[];
    rop3Component: string | null;
    allocatedValue: number | null;
    reservedUntil: Date;
  },
) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('ax-identity-explicit-codes', 13))`);
  const occupied = await occupiedCodeOwners(tx, [input.pgacCode, input.pgicCode, ...input.aliases]);
  if (occupied.size > 0) {
    throw new AxIdentityRuleError(
      "An AX canonical or alias code is already assigned.",
      "code-collision",
    );
  }
  if (input.allocatedValue !== null) {
    const allocatedRows = (await tx.execute(sql<{ identity_id: string }>`
      select id as identity_id from private.ax_identities
      where namespace = ${AX_IDENTITY_NAMESPACE} and identity_kind = 'pgac'
        and allocated_value = ${input.allocatedValue}
      limit 1
    `)) as unknown as { identity_id: string }[];
    if (allocatedRows[0]) {
      throw new AxIdentityRuleError(
        "The retained six-digit AX value is already allocated to another identity.",
        "allocated-value-collision",
      );
    }
    await tx.execute(sql`
      update private.ax_identity_counters
      set next_value = greatest(next_value, ${input.allocatedValue + 1}), updated_at = now()
      where namespace = ${AX_IDENTITY_NAMESPACE}
    `);
  }
  const iso3 = input.pgicCode.slice(-3);
  const parentRows = (await tx.execute(sql<{ id: string }>`
    insert into private.ax_identities (
      namespace, identity_kind, rop3_component, allocated_value,
      lifecycle_state, created_by_run_id
    ) values (
      ${AX_IDENTITY_NAMESPACE}, 'pgac', ${input.rop3Component}, ${input.allocatedValue},
      'reserved', ${input.runId}::uuid
    ) returning id
  `)) as unknown as { id: string }[];
  const parentId = parentRows[0]!.id;
  const childRows = (await tx.execute(sql<{ id: string }>`
    insert into private.ax_identities (
      namespace, identity_kind, parent_identity_id, normalized_iso3,
      lifecycle_state, created_by_run_id
    ) values (
      ${AX_IDENTITY_NAMESPACE}, 'pgic', ${parentId}::uuid, ${iso3},
      'reserved', ${input.runId}::uuid
    ) returning id
  `)) as unknown as { id: string }[];
  const childId = childRows[0]!.id;
  await tx.execute(sql`
    insert into private.ax_identity_codes (
      identity_id, code, code_kind, lifecycle_state, created_by_run_id
    ) values
      (${parentId}::uuid, ${input.pgacCode}, 'canonical', 'reserved', ${input.runId}::uuid),
      (${childId}::uuid, ${input.pgicCode}, 'canonical', 'reserved', ${input.runId}::uuid)
  `);
  for (const alias of input.aliases) {
    const identityId = alias.endsWith(`-${iso3}`) ? childId : parentId;
    await tx.execute(sql`
      insert into private.ax_identity_codes (
        identity_id, code, code_kind, lifecycle_state, created_by_run_id
      ) values (${identityId}::uuid, ${alias}, 'alias', 'reserved', ${input.runId}::uuid)
    `);
  }
  const bindingRows = (await tx.execute(sql<{ id: string }>`
    insert into private.ax_identity_source_bindings (
      source_profile_key, stable_row_key, identity_id, identity_run_id,
      binding_state, reserved_until
    ) values (
      ${input.sourceProfileKey}, ${input.stableRowKey}, ${childId}::uuid,
      ${input.runId}::uuid, 'reserved', ${input.reservedUntil}
    ) returning id
  `)) as unknown as { id: string }[];
  return bindingRows[0]!.id;
}

function enrichedRow(
  source: Record<string, string>,
  input: { runId: string; bindingId: string; pgacCode: string; pgicCode: string },
) {
  return {
    ...source,
    AX_PGAC: input.pgacCode,
    AX_PGIC: input.pgicCode,
    AX_Registry_Binding_ID: input.bindingId,
    AX_Identity_Run_ID: input.runId,
  };
}

export async function buildAxIdentityCandidate(input: {
  sourcePublicationId: string;
  identity: CurrentIdentity;
  reservationHours?: number;
  countryVersionId?: string;
  countryChecksum?: string;
  ropVersionId?: string;
  ropChecksum?: string;
  sourceAliasesVersionId?: string;
  sourceAliasesChecksum?: string;
  sourceAliasKey?: string;
  sourceInitials?: string;
  baseRevisionId?: string | null;
  baseRevisionChecksum?: string;
}) {
  const publication = await getPipelinePublication(input.sourcePublicationId);
  if (!publication) throw new AxIdentityRegistryError("Formed publication not found.", 404);
  if (!publication.sourceProfileKey) {
    throw new AxIdentityRegistryError("The formed publication has no source profile.", 409);
  }
  const sourceProfileKey = publication.sourceProfileKey;
  const sourceRows = await getPipelinePublicationRows(publication.id);
  if (sourceRows.length !== publication.rowCount) {
    throw new AxIdentityRegistryError(
      "The formed publication's immutable row evidence is incomplete.",
      409,
    );
  }
  const [countryResource, ropResource] = await Promise.all([
    input.countryVersionId
      ? getReferenceResourceVersion(COUNTRY_RESOURCE_KEY, input.countryVersionId)
      : getActiveReferenceResource(COUNTRY_RESOURCE_KEY),
    input.ropVersionId
      ? getReferenceResourceVersion(ROP_RESOURCE_KEY, input.ropVersionId)
      : getActiveReferenceResource(ROP_RESOURCE_KEY),
  ]);
  if (
    (input.countryChecksum &&
      countryResource.version.contentChecksum !== input.countryChecksum) ||
    (input.ropChecksum && ropResource.version.contentChecksum !== input.ropChecksum)
  ) {
    throw new AxIdentityRegistryError(
      "A pinned identity reference version no longer matches its checksum.",
      409,
    );
  }
  const allowedIso3 = new Set(
    countryResource.payload.entries
      .filter((entry) => entry.active && entry.primaryAlpha3)
      .map((entry) => entry.primaryAlpha3!),
  );
  const allowedRop3 = new Set(
    ropResource.payload.entries
      .filter((entry) => entry.status === "Active" && entry.rop3)
      .map((entry) => entry.rop3!.code),
  );
  const cutoverRows = (await getDb().execute(sql<{
    registry_revision_id: string;
    revision_number: number;
  }>`
    select cutover.registry_revision_id, revision.revision_number
    from private.ax_identity_registry_cutovers as cutover
    join private.ax_identity_legacy_imports as legacy
      on legacy.id = cutover.legacy_import_id
     and legacy.import_kind = 'verified-identity-graph'
     and legacy.status = 'committed'
     and legacy.registry_revision_id = cutover.registry_revision_id
    join private.ax_registry_revisions as revision
      on revision.id = cutover.registry_revision_id
    where cutover.namespace = 'people-groups'
    limit 1
  `)) as unknown as Array<{
    registry_revision_id: string;
    revision_number: number;
  }>;
  const revisionRows = (await getDb().execute(sql<{
        id: string;
        content_checksum: string;
        revision_number: number;
      }>`
        select id, content_checksum, revision_number
        from private.ax_registry_revisions
        where (${input.baseRevisionId ?? null}::uuid is null
          or id = ${input.baseRevisionId ?? null}::uuid)
        order by revision_number desc limit 1
      `)) as unknown as Array<{
        id: string;
        content_checksum: string;
        revision_number: number;
      }>;
  if (input.baseRevisionId && !revisionRows[0]) {
    throw new AxIdentityRegistryError(
      "The pinned AX registry revision no longer exists.",
      409,
    );
  }
  assertLegacyRegistryCutover({
    cutoverRevisionNumber: cutoverRows[0]?.revision_number ?? null,
    baseRevisionId: input.baseRevisionId,
    baseRevisionNumber: revisionRows[0]?.revision_number ?? null,
  });
  if (
    input.baseRevisionChecksum &&
    revisionRows[0]?.content_checksum !== input.baseRevisionChecksum
  ) {
    throw new AxIdentityRegistryError(
      "The pinned AX registry revision no longer matches its checksum.",
      409,
    );
  }
  const baseRevisionId = revisionRows[0]?.id ?? null;
  const suppliedSourceAliasValues = [
    input.sourceAliasesVersionId,
    input.sourceAliasesChecksum,
    input.sourceAliasKey,
    input.sourceInitials,
  ];
  const hasSourceAliasBinding = suppliedSourceAliasValues.every(
    (value) => typeof value === "string" && value.length > 0,
  );
  if (
    suppliedSourceAliasValues.some(
      (value) => typeof value === "string" && value.length > 0,
    ) !== hasSourceAliasBinding
  ) {
    throw new AxIdentityRegistryError(
      "Identity source-alias bindings must include one exact version, checksum, key, and initials.",
      409,
    );
  }
  const sourceAliasBinding = hasSourceAliasBinding
    ? {
        sourceKey: input.sourceAliasKey!,
        initials: input.sourceInitials!,
      }
    : null;
  if (sourceAliasBinding) {
    if (
      !/^[0-9a-f]{64}$/u.test(input.sourceAliasesChecksum!) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
        input.sourceAliasesVersionId!,
      )
    ) {
      throw new AxIdentityRegistryError(
        "The pinned identity source-alias version or checksum is invalid.",
        409,
      );
    }
    const sourceAliasResource = await getReferenceResourceVersion(
      SOURCE_ALIASES_RESOURCE_KEY,
      input.sourceAliasesVersionId!,
    );
    const sourceAliasPayload = sourceAliasResourceSchema.safeParse(
      sourceAliasResource.payload,
    );
    const matchingAliases = sourceAliasPayload.success
      ? sourceAliasPayload.data.entries.filter(
          (entry) =>
            entry.active &&
            entry.canonicalSourceKey === sourceAliasBinding.sourceKey &&
            entry.initials === sourceAliasBinding.initials,
        )
      : [];
    if (
      sourceAliasResource.version.contentChecksum !== input.sourceAliasesChecksum ||
      matchingAliases.length !== 1
    ) {
      throw new AxIdentityRegistryError(
        "The pinned identity source-alias entry no longer matches its versioned resource.",
        409,
      );
    }
    normalizeSourceInitials(sourceAliasBinding.sourceKey, sourceAliasBinding);
  }
  const publicationTargetKey = getAxIdentityPublicationTargetKey(sourceProfileKey);
  const currentTargetPublication = await getCurrentIdentityPublication(
    publicationTargetKey,
  );
  const expectedCurrentPublicationId = currentTargetPublication?.id ?? null;
  const resourceBindings = {
    countryVersionId: countryResource.version.id,
    countryChecksum: countryResource.version.contentChecksum!,
    ropVersionId: ropResource.version.id,
    ropChecksum: ropResource.version.contentChecksum!,
    ...(sourceAliasBinding
      ? {
          sourceAliasesVersionId: input.sourceAliasesVersionId!,
          sourceAliasesChecksum: input.sourceAliasesChecksum!,
          sourceAliasKey: sourceAliasBinding.sourceKey,
          sourceInitials: sourceAliasBinding.initials,
        }
      : {}),
  };
  const inputFingerprint = checksumIdentityValue({
    publicationId: publication.id,
    publicationChecksum: publication.outputChecksum,
    baseRevisionId,
    rulesChecksum: AX_IDENTITY_RULES_CHECKSUM,
    resourceBindings,
    publicationTargetKey,
    expectedCurrentPublicationId,
  });
  const existingRows = (await getDb().execute(sql<{ id: string }>`
    select id from private.ax_identity_runs
    where source_publication_id = ${publication.id}::uuid
      and input_fingerprint = ${inputFingerprint}
      and status not in ('failed', 'expired', 'rejected')
    order by attempt_number desc
    limit 1
  `)) as unknown as { id: string }[];
  if (existingRows[0]) return getAxIdentityRun(existingRows[0].id);

  const reservationHours = Math.max(1, Math.min(24 * 30, input.reservationHours ?? 24 * 7));
  const reservedUntil = new Date(Date.now() + reservationHours * 60 * 60 * 1000);
  const build = await getDb().transaction(async (tx) => {
    await tx.execute(sql`
      select pg_advisory_xact_lock(
        hashtextextended(
          ${`ax-identity-build:${publication.id}:${inputFingerprint}`},
          0
        )
      )
    `);
    const concurrentRows = (await tx.execute(sql<{ id: string }>`
      select id from private.ax_identity_runs
      where source_publication_id = ${publication.id}::uuid
        and input_fingerprint = ${inputFingerprint}
        and status not in ('failed', 'expired', 'rejected')
      order by attempt_number desc
      limit 1
    `)) as unknown as { id: string }[];
    if (concurrentRows[0]) {
      return {
        kind: "existing",
        runId: concurrentRows[0].id,
      } as const;
    }
    const attemptRows = (await tx.execute(sql<{ attempt_number: number }>`
      select coalesce(max(attempt_number), 0)::integer + 1 as attempt_number
      from private.ax_identity_runs
      where source_publication_id = ${publication.id}::uuid
        and input_fingerprint = ${inputFingerprint}
    `)) as unknown as Array<{ attempt_number: number }>;
    const attemptNumber = attemptRows[0]?.attempt_number ?? 1;
    const runRows = (await tx.execute(sql<{ id: string }>`
      insert into private.ax_identity_runs (
        source_publication_id, base_revision_id, source_profile_key,
        rules_version, rules_checksum, resource_bindings, input_fingerprint,
        attempt_number,
        publication_target_key, expected_current_publication_id,
        actor_owner_id, actor_email, status, input_row_count,
        reservation_expires_at, started_at
      ) values (
        ${publication.id}::uuid, ${baseRevisionId}::uuid, ${sourceProfileKey},
        ${AX_IDENTITY_RULES_VERSION}, ${AX_IDENTITY_RULES_CHECKSUM},
        ${JSON.stringify(resourceBindings)}::jsonb, ${inputFingerprint},
        ${attemptNumber},
        ${publicationTargetKey}, ${expectedCurrentPublicationId}::uuid,
        ${input.identity.ownerId}, ${input.identity.email}, 'building', ${sourceRows.length},
        ${reservedUntil}, now()
      ) returning id
    `)) as unknown as { id: string }[];
    const runId = runRows[0]!.id;
    const findings: AxIdentityFinding[] = [];
    const rows: AxIdentityCandidateRow[] = [];
    const stableKeys = new Set<string>();

    for (const source of sourceRows) {
      const stableRowKey = textField(source.data, ["Dataset_Row_Key", "dataset_row_key"]);
      if (!stableRowKey || stableKeys.has(stableRowKey)) {
        const ruleCode = stableRowKey ? "duplicate-stable-row-key" : "missing-stable-row-key";
        findings.push(
          errorFinding({
            ruleCode,
            sourceRowIndex: source.row_index,
            stableRowKey,
            message: stableRowKey
              ? "The formed publication repeats a stable source row key."
              : "The formed publication row has no stable source row key.",
          }),
        );
        rows.push({
          sourceRowIndex: source.row_index,
          stableRowKey,
          assignmentStatus: stableRowKey ? "conflict" : "unassignable",
          bindingId: null,
          pgacCode: null,
          pgicCode: null,
          enrichedRow: source.data,
        });
        continue;
      }
      stableKeys.add(stableRowKey);

      const existing = await currentBinding(
        tx,
        sourceProfileKey,
        stableRowKey,
        runId,
        baseRevisionId,
      );
      if (existing) {
        rows.push({
          sourceRowIndex: source.row_index,
          stableRowKey,
          assignmentStatus: "reused",
          bindingId: existing.binding_id,
          pgacCode: existing.pgac_code,
          pgicCode: existing.pgic_code,
          enrichedRow: enrichedRow(source.data, {
            runId,
            bindingId: existing.binding_id,
            pgacCode: existing.pgac_code,
            pgicCode: existing.pgic_code,
          }),
        });
        continue;
      }

      try {
        const sourceName = textField(source.data, ["Data_Source", "data_source"]) ?? sourceProfileKey;
        const sourceInitials = normalizeSourceInitials(
          sourceName,
          sourceAliasBinding,
        );
        const rop1 = normalizeRop1(textField(source.data, ["PG_ROP1", "ROP1", "rop1"]));
        const rop3 = normalizeRop3(
          textField(source.data, ["PG_ROP3", "ROP3", "rop3"]),
          allowedRop3,
        );
        const iso3 = normalizeIso3(
          textField(source.data, ["Geo_ISO3", "ISO3", "iso3"]),
          allowedIso3,
        );
        const sourcePgac = textField(source.data, ["AX_PGAC", "PGAC", "PG_AC"]);
        const sourcePgic = textField(source.data, ["AX_PGIC", "PGIC", "PG_IC"]);
        let pgacCode: string;
        let pgicCode: string;
        let aliases: readonly string[] = [];
        let assignmentStatus: "retained" | "reserved" = "reserved";
        let bindingId: string;

        if (rop3) {
          const generated = buildAxIdentityCodes({
            source: sourceName,
            sourceAliasBinding,
            rop1,
            sixDigit: rop3,
            sixDigitKind: "rop3",
            iso3,
            allowedRop3,
            allowedIso3,
          });
          const decision = reconcileAxIdentity({
            existing: null,
            generatedPgac: generated.pgac,
            generatedPgic: generated.pgic,
            sourcePgac,
            sourcePgic,
            occupiedCodes: await occupiedCodeOwners(
              tx,
              [sourcePgac, sourcePgic].filter((value): value is string => Boolean(value)),
            ),
          });
          if (decision.status === "conflict" || !decision.pgacCode || !decision.pgicCode) {
            findings.push(
              errorFinding({
                ruleCode: "source-code-conflict",
                sourceRowIndex: source.row_index,
                stableRowKey,
                message: decision.reason,
              }),
            );
            rows.push({
              sourceRowIndex: source.row_index,
              stableRowKey,
              assignmentStatus: "conflict",
              bindingId: null,
              pgacCode: null,
              pgicCode: null,
              enrichedRow: source.data,
            });
            continue;
          }
          pgacCode = decision.pgacCode;
          pgicCode = decision.pgicCode;
          aliases = decision.aliases;
          assignmentStatus = decision.status === "retained" ? "retained" : "reserved";
          bindingId = await reserveExplicitIdentity(tx, {
            runId,
            sourceProfileKey,
            stableRowKey,
            pgacCode,
            pgicCode,
            aliases,
            rop3Component: pgacCode === generated.pgac ? rop3 : null,
            allocatedValue: null,
            reservedUntil,
          });
        } else if (sourcePgac || sourcePgic) {
          if (
            !sourcePgac || !sourcePgic ||
            !isStructurallyValidAxCode(sourcePgac, "pgac") ||
            !isStructurallyValidAxCode(sourcePgic, "pgic") ||
            !sourcePgic.startsWith(`${sourcePgac}-`) || sourcePgic.slice(-3) !== iso3
          ) {
            throw new AxIdentityRuleError(
              "The retained source AX code pair is malformed or does not match ISO3.",
              "invalid-source-code",
            );
          }
          pgacCode = sourcePgac;
          pgicCode = sourcePgic;
          assignmentStatus = "retained";
          bindingId = await reserveExplicitIdentity(tx, {
            runId,
            sourceProfileKey,
            stableRowKey,
            pgacCode,
            pgicCode,
            aliases: [],
            rop3Component: null,
            allocatedValue: Number(pgacCode.split("-").at(-1)),
            reservedUntil,
          });
        } else {
          const counterRows = (await tx.execute(sql<{ next_value: number; maximum_value: number }>`
            select next_value, maximum_value from private.ax_identity_counters
            where namespace = ${AX_IDENTITY_NAMESPACE}
          `)) as unknown as { next_value: number; maximum_value: number }[];
          if (!counterRows[0] || counterRows[0].next_value > counterRows[0].maximum_value) {
            findings.push(
              errorFinding({
                ruleCode: "identity-namespace-exhausted",
                sourceRowIndex: source.row_index,
                stableRowKey,
                message: "The AX six-digit identity namespace is exhausted.",
              }),
            );
            rows.push({
              sourceRowIndex: source.row_index,
              stableRowKey,
              assignmentStatus: "unassignable",
              bindingId: null,
              pgacCode: null,
              pgicCode: null,
              enrichedRow: source.data,
            });
            continue;
          }
          const allocationRows = (await tx.execute(sql<{
            binding_id: string;
            identity_id: string;
            allocated_value: number;
            pgac_code: string;
            pgic_code: string;
            reused: boolean;
          }>`
            select * from private.allocate_ax_identity_value(
              ${AX_IDENTITY_NAMESPACE}, ${sourceProfileKey}, ${stableRowKey},
              ${runId}::uuid, ${rop1}, ${sourceInitials}, ${iso3}, ${reservedUntil}
            )
          `)) as unknown as Array<{
            binding_id: string;
            identity_id: string;
            allocated_value: number;
            pgac_code: string;
            pgic_code: string;
            reused: boolean;
          }>;
          const allocation = allocationRows[0]!;
          bindingId = allocation.binding_id;
          pgacCode = allocation.pgac_code;
          pgicCode = allocation.pgic_code;
        }

        rows.push({
          sourceRowIndex: source.row_index,
          stableRowKey,
          assignmentStatus,
          bindingId,
          pgacCode,
          pgicCode,
          enrichedRow: enrichedRow(source.data, { runId, bindingId, pgacCode, pgicCode }),
        });
      } catch (error) {
        if (!(error instanceof AxIdentityRuleError)) throw error;
        findings.push(
          errorFinding({
            ruleCode: error.ruleCode,
            sourceRowIndex: source.row_index,
            stableRowKey,
            message: error.message,
          }),
        );
        rows.push({
          sourceRowIndex: source.row_index,
          stableRowKey,
          assignmentStatus: "unassignable",
          bindingId: null,
          pgacCode: null,
          pgicCode: null,
          enrichedRow: source.data,
        });
      }
    }

    for (const row of rows) {
      await tx.execute(sql`
        insert into private.ax_identity_run_rows (
          identity_run_id, source_row_index, stable_row_key, assignment_status,
          binding_id, pgac_code, pgic_code, enriched_row
        ) values (
          ${runId}::uuid, ${row.sourceRowIndex}, ${row.stableRowKey},
          ${row.assignmentStatus}, ${row.bindingId}::uuid, ${row.pgacCode},
          ${row.pgicCode}, ${JSON.stringify(row.enrichedRow)}::jsonb
        )
      `);
    }
    for (const finding of findings) {
      await tx.execute(sql`
        insert into private.ax_identity_findings (
          identity_run_id, severity, rule_code, source_row_index,
          stable_row_key, message, details
        ) values (
          ${runId}::uuid, ${finding.severity}, ${finding.ruleCode},
          ${finding.sourceRowIndex}, ${finding.stableRowKey}, ${finding.message},
          ${JSON.stringify(finding.details)}::jsonb
        )
      `);
    }

    const artifacts = prepareAxIdentityArtifacts({
      runId,
      sourcePublicationId: publication.id,
      sourceProfileKey,
      baseRevisionId,
      rulesVersion: AX_IDENTITY_RULES_VERSION,
      rulesChecksum: AX_IDENTITY_RULES_CHECKSUM,
      resourceBindings,
      rows,
      findings,
    });
    const counts = {
      reused: rows.filter((row) => row.assignmentStatus === "reused").length,
      retained: rows.filter((row) => row.assignmentStatus === "retained").length,
      reserved: rows.filter((row) => row.assignmentStatus === "reserved").length,
      conflict: rows.filter((row) => row.assignmentStatus === "conflict").length,
      unassignable: rows.filter((row) => row.assignmentStatus === "unassignable").length,
    };
    await tx.execute(sql`
      update private.ax_identity_runs set
        output_row_count = ${rows.length}, reused_count = ${counts.reused},
        retained_count = ${counts.retained}, reserved_count = ${counts.reserved},
        conflict_count = ${counts.conflict}, unassignable_count = ${counts.unassignable},
        warning_count = ${findings.filter((entry) => entry.severity === "warning").length},
        error_count = ${findings.filter((entry) => entry.severity === "error").length},
        output_checksum = ${artifacts.outputChecksum},
        row_evidence_checksum = (
          select encode(extensions.digest(
            coalesce(jsonb_agg(jsonb_build_object(
              'sourceRowIndex', source_row_index,
              'data', enriched_row
            ) order by source_row_index)::text, '[]'),
            'sha256'
          ), 'hex')
          from private.ax_identity_run_rows
          where identity_run_id = ${runId}::uuid
        )
      where id = ${runId}::uuid
    `);
    return {
      kind: "draft",
      draft: {
        runId,
        rows,
        findings,
        artifacts,
        blocking: findings.some((entry) => entry.severity === "error"),
      },
    } as const;
  });
  if (build.kind === "existing") {
    return getAxIdentityRun(build.runId);
  }
  const draft = build.draft;

  const uploadedPaths: string[] = [];
  try {
    const bodies: Record<AxIdentityArtifactKind, string> = {
      rows: draft.artifacts.rowsJson,
      findings: draft.artifacts.findingsJson,
      manifest: draft.artifacts.manifestJson,
      csv: draft.artifacts.csv,
    };
    const manifest: Record<string, string> = {};
    for (const kind of ["rows", "findings", "manifest", "csv"] as const) {
      const path = await uploadAxIdentityArtifact({ runId: draft.runId, kind, body: bodies[kind] });
      uploadedPaths.push(path);
      manifest[kind] = path;
    }
    await getDb().transaction(async (tx) => {
      for (const kind of ["rows", "findings", "manifest", "csv"] as const) {
        await tx.execute(sql`
          insert into private.ax_identity_artifacts (
            identity_run_id, artifact_kind, storage_path, content_checksum, size_bytes
          ) values (
            ${draft.runId}::uuid, ${kind}, ${manifest[kind]},
            ${checksumIdentityValue(bodies[kind])}, ${Buffer.byteLength(bodies[kind], "utf8")}
          )
        `);
      }
      await tx.execute(sql`
        update private.ax_identity_runs set
          status = ${draft.blocking ? "invalid" : "valid"},
          artifact_manifest = ${JSON.stringify(manifest)}::jsonb,
          completed_at = now()
        where id = ${draft.runId}::uuid and status = 'building'
      `);
    });
  } catch (error) {
    await deleteAxIdentityArtifacts(uploadedPaths).catch(() => undefined);
    await getDb().transaction(async (tx) => {
      await tx.execute(sql`select private.cancel_ax_identity_run_reservations(${draft.runId}::uuid)`);
      await tx.execute(sql`
        update private.ax_identity_runs set status = 'failed',
          error_message = ${error instanceof Error ? error.message : "AX identity build failed."},
          completed_at = now()
        where id = ${draft.runId}::uuid and status = 'building'
      `);
    });
    throw error;
  }
  return getAxIdentityRun(draft.runId);
}

export async function rejectAxIdentityCandidate(input: {
  runId: string;
  reason: string;
  identity: CurrentIdentity;
}) {
  const reason = input.reason.trim();
  if (!reason) throw new AxIdentityRegistryError("A rejection reason is required.");
  await getDb().transaction(async (tx) => {
    const rows = (await tx.execute(sql<{ status: string }>`
      select status from private.ax_identity_runs where id = ${input.runId}::uuid for update
    `)) as unknown as { status: string }[];
    if (!rows[0]) throw new AxIdentityRegistryError("Identity candidate not found.", 404);
    if (!new Set(["building", "valid", "invalid"]).has(rows[0].status)) {
      throw new AxIdentityRegistryError("Identity candidate can no longer be rejected.", 409);
    }
    await tx.execute(sql`select private.cancel_ax_identity_run_reservations(${input.runId}::uuid)`);
    await tx.execute(sql`
      update private.ax_identity_runs set status = 'rejected', rejection_reason = ${reason},
        rejected_by_owner_id = ${input.identity.ownerId}, rejected_at = now(), completed_at = coalesce(completed_at, now())
      where id = ${input.runId}::uuid
    `);
  });
  return getAxIdentityRun(input.runId);
}

type AxIdentityArtifactRecord = {
  artifact_kind: AxIdentityArtifactKind;
  storage_path: string;
  content_checksum: string;
  size_bytes: number;
};

export async function verifyAxIdentityRunArtifacts(runId: string) {
  const run = await getAxIdentityRun(runId);
  if (!run) throw new AxIdentityRegistryError("Identity candidate not found.", 404);
  const required = ["rows", "findings", "manifest", "csv"] as const;
  if (required.some((kind) => !run.artifactManifest[kind])) {
    throw new AxIdentityRegistryError("Identity candidate artifacts are incomplete.", 409);
  }
  const [rowsJson, findingsJson, manifestJson, csv] = await Promise.all(
    required.map((kind) => readAxIdentityArtifact(run.artifactManifest[kind]!)),
  );
  const records = (await getDb().execute(sql<AxIdentityArtifactRecord>`
    select artifact_kind, storage_path, content_checksum, size_bytes
    from private.ax_identity_artifacts
    where identity_run_id = ${runId}::uuid
      and artifact_kind in ('rows', 'findings', 'manifest', 'csv')
  `)) as unknown as AxIdentityArtifactRecord[];
  const byKind = new Map(records.map((record) => [record.artifact_kind, record]));
  const actualBodies = { rows: rowsJson, findings: findingsJson, manifest: manifestJson, csv };
  if (required.some((kind) => {
    const record = byKind.get(kind);
    const body = actualBodies[kind];
    return !record || record.storage_path !== run.artifactManifest[kind] ||
      record.content_checksum !== checksumIdentityValue(body) ||
      record.size_bytes !== Buffer.byteLength(body, "utf8");
  })) {
    throw new AxIdentityRegistryError(
      "Identity candidate artifact evidence does not match its immutable audit records.",
      409,
    );
  }
  const expected = prepareAxIdentityArtifacts({
    runId: run.id,
    sourcePublicationId: run.sourcePublicationId,
    sourceProfileKey: run.sourceProfileKey,
    baseRevisionId: run.baseRevisionId,
    rulesVersion: run.rulesVersion,
    rulesChecksum: run.rulesChecksum,
    resourceBindings: run.resourceBindings,
    rows: run.rows,
    findings: run.findings,
  });
  if (
    rowsJson !== expected.rowsJson || findingsJson !== expected.findingsJson ||
    manifestJson !== expected.manifestJson || csv !== expected.csv ||
    run.outputChecksum !== expected.outputChecksum
  ) {
    throw new AxIdentityRegistryError("Identity candidate artifact checksums do not match.", 409);
  }
  return { run, ...expected };
}

export async function recoverStaleAxIdentityPublications(input?: {
  runId?: string;
  now?: Date;
}) {
  const cutoff = new Date(
    (input?.now ?? new Date()).getTime() - AX_IDENTITY_PUBLICATION_LEASE_MS,
  );
  const rows = (await getDb().execute(sql<{
    id: string;
    publication_blob_path: string | null;
  }>`
    with stale as (
      select id, publication_blob_path
      from private.ax_identity_runs
      where status = 'publishing'
        and publication_id is null
        and publishing_started_at < ${cutoff}
        and (${input?.runId ?? null}::uuid is null or id = ${input?.runId ?? null}::uuid)
      order by publishing_started_at, id
      for update skip locked
    ), recovered as (
      update private.ax_identity_runs as run
      set status = 'valid', publication_attempt_id = null,
        publishing_started_at = null, publication_blob_path = null,
        error_message = 'A stale identity publication lease was recovered.'
      from stale
      where run.id = stale.id
      returning run.id, stale.publication_blob_path
    )
    select id, publication_blob_path from recovered
  `)) as unknown as Array<{ id: string; publication_blob_path: string | null }>;
  await Promise.all(
    rows.flatMap((row) =>
      row.publication_blob_path
        ? [deletePipelineDatasetBlob(row.publication_blob_path).catch(() => undefined)]
        : [],
    ),
  );
  return rows.length;
}

export async function publishAxIdentityCandidate(input: {
  runId: string;
  reason: string;
  identity: CurrentIdentity;
}): Promise<AxIdentityPublicationResult> {
  const reason = input.reason.trim();
  if (!reason) throw new AxIdentityRegistryError("A publication reason is required.");
  await recoverStaleAxIdentityPublications({ runId: input.runId });
  const evidence = await verifyAxIdentityRunArtifacts(input.runId);
  if (evidence.run.status === "published") {
    return {
      revisionId: evidence.run.registryRevisionId!,
      publicationId: evidence.run.publicationId!,
      datasetId: evidence.run.datasetId!,
    };
  }
  if (evidence.run.status !== "valid") {
    throw new AxIdentityRegistryError("Only a valid identity candidate can publish.", 409);
  }
  const currentPublication = await getCurrentIdentityPublication(
    evidence.run.publicationTargetKey,
  );
  assertExpectedIdentityPublication({
    expectedCurrentPublicationId: evidence.run.expectedCurrentPublicationId,
    currentPublicationId: currentPublication?.id ?? null,
  });
  const fileName = `${evidence.run.sourceProfileKey}-identity.csv`;
  const blobPath = createDatasetStoragePath(fileName);
  const publicationAttemptId = randomUUID();
  let blobCommitted = false;
  let publicationClaimed = false;
  try {
    let claims: { id: string }[];
    try {
      claims = (await getDb().execute(sql<{ id: string }>`
        update private.ax_identity_runs as run
        set status = 'publishing', publication_attempt_id = ${publicationAttemptId}::uuid,
          publishing_started_at = now(), publication_blob_path = ${blobPath},
          error_message = null
        where run.id = ${input.runId}::uuid and run.status = 'valid'
          and run.publication_target_key = ${evidence.run.publicationTargetKey}
          and run.expected_current_publication_id is not distinct from
            ${evidence.run.expectedCurrentPublicationId}::uuid
          and run.expected_current_publication_id is not distinct from (
            select publication.id
            from private.pipeline_publications as publication
            where publication.producer_kind = 'identity'
              and publication.publication_target_key = run.publication_target_key
            order by publication.created_at desc, publication.id desc
            limit 1
          )
        returning run.id
      `)) as unknown as { id: string }[];
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === "23505") {
        throw new AxIdentityRegistryError(
          "Another candidate for this identity target is already publishing.",
          409,
        );
      }
      throw error;
    }
    if (!claims[0]) {
      throw new AxIdentityRegistryError(
        "The identity candidate or its publication target changed before publication could start.",
        409,
      );
    }
    publicationClaimed = true;
    await uploadPipelineDatasetBlob({
      fileName,
      csv: evidence.csv,
      storagePath: blobPath,
    });
    let anchors: AxIdentityPublicationResult | null = null;
    const prepared = await publishPreparedDataset({
      targetDatasetId: currentPublication?.datasetId ?? null,
      actorOwnerId: input.identity.ownerId,
      actorEmail: input.identity.email,
      fileName,
      blobPath,
      sizeBytes: Buffer.byteLength(evidence.csv, "utf8"),
      columns: [...evidence.columns],
      rows: evidence.run.rows.map((row) => ({ ...row.enrichedRow })),
      classification: "PGIC",
      isWorkspaceVisible: false,
      finalize: async ({ executor, datasetId, created }) => {
        const rows = (await executor.execute(sql<{
          revision_id: string;
          publication_id: string;
          dataset_id: string;
        }>`
          select * from private.finalize_ax_identity_publication(
            ${input.runId}::uuid, ${datasetId}::uuid,
            ${publicationAttemptId}::uuid, ${created}, ${input.identity.ownerId},
            ${input.identity.email}, ${reason}
          )
        `)) as unknown as Array<{
          revision_id: string;
          publication_id: string;
          dataset_id: string;
        }>;
        const result = rows[0];
        if (!result) {
          throw new Error("AX identity publication did not return its audit anchors.");
        }
        anchors = {
          revisionId: result.revision_id,
          publicationId: result.publication_id,
          datasetId: result.dataset_id,
        };
      },
    });
    if (!prepared || !anchors) {
      throw new AxIdentityRegistryError("The identity publication target disappeared.", 409);
    }
    blobCommitted = true;
    return anchors;
  } catch (error) {
    if (!blobCommitted) {
      await deletePipelineDatasetBlob(blobPath).catch(() => undefined);
    }
    if (publicationClaimed) {
      await getDb().execute(sql`
        update private.ax_identity_runs
        set status = 'valid', publication_attempt_id = null,
          publishing_started_at = null, publication_blob_path = null,
          error_message = ${error instanceof Error ? error.message : "AX identity publication failed."}
        where id = ${input.runId}::uuid and status = 'publishing'
          and publication_attempt_id = ${publicationAttemptId}::uuid
          and publication_id is null
      `).catch(() => undefined);
    }
    throw error;
  }
}

export async function downloadAxIdentityCandidateArtifact(input: {
  runId: string;
  kind: AxIdentityArtifactKind;
}) {
  const run = await getAxIdentityRun(input.runId);
  if (!run) throw new AxIdentityRegistryError("Identity candidate not found.", 404);
  const path = run.artifactManifest[input.kind];
  if (!path) throw new AxIdentityRegistryError("Identity candidate artifact not found.", 404);
  return readAxIdentityArtifact(path);
}

export async function expireStaleAxIdentityReservations(now = new Date()) {
  const rows = (await getDb().execute(sql<{ id: string }>`
    select id from private.ax_identity_runs
    where status in ('building', 'valid', 'invalid')
      and reservation_expires_at is not null and reservation_expires_at <= ${now}
    order by reservation_expires_at, id
  `)) as unknown as { id: string }[];
  let expired = 0;
  for (const row of rows) {
    const results = (await getDb().execute(sql<{ expired: boolean }>`
      select private.expire_ax_identity_run(${row.id}::uuid, ${now}) as expired
    `)) as unknown as Array<{ expired: boolean }>;
    if (results[0]?.expired) expired += 1;
  }
  return expired;
}

export async function getAxIdentityRegistryOverview() {
  const [bindings, revisions, runs] = await Promise.all([
    listActiveIdentityBindings(),
    listIdentityRegistryRevisions(),
    listAxIdentityRuns(),
  ]);
  return { bindings, revisions, runs };
}

export async function importLegacyIdentitySnapshots(input: {
  snapshots: readonly LegacyIdentitySnapshot[];
  commit?: boolean;
  reason?: string;
  identity: CurrentIdentity;
}) {
  if (input.commit) {
    throw new AxIdentityRegistryError(
      "Legacy AX identity commits require the pinned identity graph importer.",
      409,
    );
  }
  const existing = await listActiveIdentityBindings();
  const result = inspectLegacyIdentitySnapshots({
    snapshots: input.snapshots,
    existingCodes: new Map(
      existing.flatMap((binding) => [
        [binding.pgacCode, `${binding.sourceProfileKey}:${binding.stableRowKey}`] as const,
        [binding.pgicCode, `${binding.sourceProfileKey}:${binding.stableRowKey}`] as const,
      ]),
    ),
  });
  const reason = input.reason?.trim() ?? "Legacy AX identity snapshot review";
  const existingImports = (await getDb().execute(sql<{ id: string; status: string }>`
    select id, status from private.ax_identity_legacy_imports
    where input_fingerprint = ${result.inputFingerprint}
    limit 1
  `)) as unknown as { id: string; status: string }[];
  if (existingImports[0]?.status === "committed" || !input.commit) {
    if (!existingImports[0]) {
      await getDb().execute(sql`
        insert into private.ax_identity_legacy_imports (
          input_fingerprint, snapshot_manifest, status, finding_count,
          actor_owner_id, actor_email, reason
        ) values (
          ${result.inputFingerprint},
          ${JSON.stringify(input.snapshots.map((snapshot) => ({ path: snapshot.path, checksum: snapshot.expectedChecksum })))}::jsonb,
          ${result.blocking ? "blocked" : "dry-run"}, ${result.findings.length},
          ${input.identity.ownerId}, ${input.identity.email}, ${reason}
        )
      `);
    }
    return { ...result, committedImportId: existingImports[0]?.status === "committed" ? existingImports[0].id : null };
  }

  const importId = existingImports[0]?.id ?? (
    (await getDb().execute(sql<{ id: string }>`
      insert into private.ax_identity_legacy_imports (
        input_fingerprint, snapshot_manifest, status, finding_count,
        actor_owner_id, actor_email, reason
      ) values (
        ${result.inputFingerprint},
        ${JSON.stringify(input.snapshots.map((snapshot) => ({ path: snapshot.path, checksum: snapshot.expectedChecksum })))}::jsonb,
        'dry-run', 0, ${input.identity.ownerId}, ${input.identity.email}, ${reason}
      ) returning id
    `)) as unknown as { id: string }[]
  )[0]!.id;

  await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('ax-identity-publication', 11))`);
    const maximumImportedValue = result.rows.reduce(
      (maximum, row) => Math.max(maximum, row.uuid ? Number(row.uuid) : 0),
      0,
    );
    if (maximumImportedValue > 0) {
      await tx.execute(sql`
        update private.ax_identity_counters
        set next_value = greatest(next_value, ${maximumImportedValue + 1}), updated_at = now()
        where namespace = ${AX_IDENTITY_NAMESPACE}
      `);
    }
    for (const row of result.rows) {
      const iso3 = row.pgicCode.slice(-3);
      const parentRows = (await tx.execute(sql<{ id: string }>`
        insert into private.ax_identities (
          namespace, identity_kind, allocated_value, lifecycle_state,
          created_by_import_id, activated_at
        ) values (
          ${AX_IDENTITY_NAMESPACE}, 'pgac', ${row.uuid ? Number(row.uuid) : null},
          'active', ${importId}::uuid, now()
        )
        returning id
      `)) as unknown as { id: string }[];
      const parentId = parentRows[0]!.id;
      const childRows = (await tx.execute(sql<{ id: string }>`
        insert into private.ax_identities (
          namespace, identity_kind, parent_identity_id, normalized_iso3,
          lifecycle_state, created_by_import_id, activated_at
        ) values (${AX_IDENTITY_NAMESPACE}, 'pgic', ${parentId}::uuid, ${iso3}, 'active', ${importId}::uuid, now())
        returning id
      `)) as unknown as { id: string }[];
      const childId = childRows[0]!.id;
      await tx.execute(sql`
        insert into private.ax_identity_codes (
          identity_id, code, code_kind, lifecycle_state, created_by_import_id
        ) values
          (${parentId}::uuid, ${row.pgacCode}, 'canonical', 'active', ${importId}::uuid),
          (${childId}::uuid, ${row.pgicCode}, 'canonical', 'active', ${importId}::uuid)
      `);
      for (const alias of row.aliases) {
        await tx.execute(sql`
          insert into private.ax_identity_codes (
            identity_id, code, code_kind, lifecycle_state, created_by_import_id
          ) values (
            ${alias.endsWith(`-${iso3}`) ? childId : parentId}::uuid,
            ${alias}, 'alias', 'active', ${importId}::uuid
          )
        `);
      }
      await tx.execute(sql`
        insert into private.ax_identity_source_bindings (
          source_profile_key, stable_row_key, identity_id, legacy_import_id,
          binding_state, activated_at
        ) values (
          ${row.sourceProfileKey}, ${row.stableRowKey}, ${childId}::uuid,
          ${importId}::uuid, 'active', now()
        )
      `);
    }
    const bindingRows = (await tx.execute(sql<{ count: number; checksum: string }>`
      select count(*)::integer as count,
        encode(extensions.digest(coalesce(string_agg(
          source_profile_key || ':' || stable_row_key || ':' || identity_id::text,
          '|' order by source_profile_key, stable_row_key, identity_id
        ), ''), 'sha256'), 'hex') as checksum
      from private.ax_identity_source_bindings where binding_state = 'active'
    `)) as unknown as { count: number; checksum: string }[];
    const revisionRows = (await tx.execute(sql<{ id: string }>`
      insert into private.ax_registry_revisions (
        previous_revision_id, content_checksum, binding_count,
        actor_owner_id, actor_email, reason
      ) values (
        (select id from private.ax_registry_revisions order by revision_number desc limit 1),
        ${bindingRows[0]!.checksum}, ${bindingRows[0]!.count},
        ${input.identity.ownerId}, ${input.identity.email}, ${reason}
      ) returning id
    `)) as unknown as { id: string }[];
    const revisionId = revisionRows[0]!.id;
    await tx.execute(sql`
      update private.ax_identity_source_bindings set activated_revision_id = ${revisionId}::uuid
      where legacy_import_id = ${importId}::uuid;
      update private.ax_identities set activated_revision_id = ${revisionId}::uuid
      where created_by_import_id = ${importId}::uuid;
      update private.ax_identity_codes set activated_revision_id = ${revisionId}::uuid
      where created_by_import_id = ${importId}::uuid;
      insert into private.ax_registry_revision_bindings (revision_id, binding_id)
      select ${revisionId}::uuid, id from private.ax_identity_source_bindings where binding_state = 'active';
      update private.ax_identity_legacy_imports set status = 'committed',
        registry_revision_id = ${revisionId}::uuid, committed_at = now(), reason = ${reason}
      where id = ${importId}::uuid;
    `);
  });
  return { ...result, committedImportId: importId };
}
