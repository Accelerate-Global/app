import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import type { CurrentIdentity } from "@/lib/auth";
import { createDatasetStoragePath } from "@/lib/dataset-storage";
import { getDatasetClassification } from "@/lib/dataset-tags";
import { getDataset, publishPreparedDataset } from "@/lib/datasets";
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
import { reconcileAxIdentity } from "./reconcile";
import {
  AX_IDENTITY_FORMATTER_CHECKSUM,
  AX_IDENTITY_RULES_CHECKSUM,
  AxIdentityRuleError,
  buildAxIdentityCodes,
  normalizeOptionalIso3,
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
  type AxIdentityChangeAction,
  type AxIdentityCandidateRow,
  type AxIdentityFinding,
  type AxIdentityPublicationResult,
} from "./types";
import {
  getAxIdentityRun,
  getCurrentIdentityPublication,
  getPipelinePublication,
  getPipelinePublicationRows,
  listActiveIdentityBindings,
  listAxIdentityRuns,
  listIdentityRegistryRevisions,
  getAxIdentityAuthorityStatus,
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

export function assertFreshIdentityAuthority(input: {
  initialized: boolean;
  authorityRevisionId: string | null | undefined;
  baseRevisionId: string | null | undefined;
}) {
  if (!input.initialized || !input.authorityRevisionId) {
    throw new AxIdentityRegistryError(
      "The fresh AX Online identity authority must be initialized before identity allocation can begin.",
      409,
    );
  }
  if (input.baseRevisionId == null) {
    throw new AxIdentityRegistryError(
      "An exact AX Online registry revision is required for identity allocation.",
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

function warningFinding(input: {
  ruleCode: string;
  sourceRowIndex: number;
  stableRowKey: string | null;
  message: string;
  details?: Record<string, unknown>;
}): AxIdentityFinding {
  return {
    severity: "warning",
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
  pgac_identity_id: string;
  pgac_code: string;
  pgic_code: string | null;
  binding_state: "reserved" | "active";
  identity_evidence: Record<string, unknown>;
  evidence_checksum: string | null;
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
      parent.id as pgac_identity_id,
      parent_code.code as pgac_code, child_code.code as pgic_code,
      binding.binding_state, binding.identity_evidence, binding.evidence_checksum
    from private.ax_identity_source_bindings as binding
    join private.ax_identities as assigned on assigned.id = binding.identity_id
    join private.ax_identities as parent
      on parent.id = case when assigned.identity_kind = 'pgic'
        then assigned.parent_identity_id else assigned.id end
    join private.ax_identity_codes as parent_code
      on parent_code.identity_id = parent.id and parent_code.code_kind = 'canonical'
        and parent_code.lifecycle_state in ('reserved', 'active')
    left join private.ax_identity_codes as child_code
      on child_code.identity_id = assigned.id and assigned.identity_kind = 'pgic'
        and child_code.code_kind = 'canonical'
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

type CanonicalIdentityEvidence = Readonly<{
  classification: "PGAC" | "PGIC";
  rop1: string | null;
  sourceInitials: string;
  rop3: string | null;
  iso3: string | null;
  countryVersionId: string;
  countryChecksum: string;
  ropVersionId: string;
  ropChecksum: string;
}>;

const IDENTITY_INERT_SOURCE_FIELDS = new Set([
  "AX_CODE",
  "AX_ID",
  "AX_PGAC",
  "AX_PGIC",
  "AXCODE",
  "PG_AC",
  "PG_IC",
  "PGAC",
  "PGIC",
]);

export function stripSourceSuppliedAxCodes(row: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(row).filter(
      ([key]) => !IDENTITY_INERT_SOURCE_FIELDS.has(key.trim().toUpperCase()),
    ),
  );
}

function identityEvidenceChecksum(evidence: CanonicalIdentityEvidence) {
  return checksumIdentityValue(evidence);
}

async function reserveRop3Identity(
  tx: DbTransaction,
  input: {
    runId: string;
    sourceProfileKey: string;
    stableRowKey: string;
    pgacCode: string;
    pgicCode: string | null;
    rop3: string;
    iso3: string | null;
    ropVersionId: string;
    ropChecksum: string;
    identityEvidence: CanonicalIdentityEvidence;
    reservedUntil: Date;
    supersedesBindingId?: string | null;
    requireExistingOwner?: boolean;
    forbidExistingOwner?: boolean;
    allowedExistingOwnerId?: string | null;
  },
) {
  await tx.execute(sql`
    select pg_advisory_xact_lock(hashtextextended(${`ax-identity-rop3:${input.rop3}`}, 13))
  `);
  const owners = (await tx.execute(sql<{
    pgac_identity_id: string;
    identity_run_id: string;
    evidence_state: "reserved" | "active";
    pgac_code: string;
  }>`
    select evidence.pgac_identity_id, evidence.identity_run_id,
      evidence.evidence_state, code.code as pgac_code
    from private.ax_identity_rop3_evidence as evidence
    join private.ax_identity_codes as code
      on code.identity_id = evidence.pgac_identity_id
     and code.code_kind = 'canonical'
     and code.lifecycle_state in ('reserved', 'active')
    where evidence.rop3 = ${input.rop3}
      and evidence.evidence_state in ('reserved', 'active')
    limit 1
  `)) as unknown as Array<{
    pgac_identity_id: string;
    identity_run_id: string;
    evidence_state: "reserved" | "active";
    pgac_code: string;
  }>;

  let parentId = owners[0]?.pgac_identity_id ?? null;
  const pgacCode = owners[0]?.pgac_code ?? input.pgacCode;
  if (owners[0]?.evidence_state === "reserved" && owners[0].identity_run_id !== input.runId) {
    throw new AxIdentityRuleError(
      "The exact current ROP3 is reserved by another identity candidate.",
      "rop3-evidence-reserved",
    );
  }
  if (input.requireExistingOwner && !parentId) {
    throw new AxIdentityRuleError(
      "Rebinding requires an active identity already owned by the exact current ROP3.",
      "rebind-owner-missing",
    );
  }
  if (input.forbidExistingOwner && parentId) {
    throw new AxIdentityRuleError(
      "A new identity cannot be created because the exact current ROP3 already has an active owner.",
      "rop3-owner-already-exists",
    );
  }
  if (
    parentId && input.allowedExistingOwnerId !== undefined &&
    parentId !== input.allowedExistingOwnerId
  ) {
    throw new AxIdentityRuleError(
      "The proposed ROP3 belongs to another active identity; select rebind instead.",
      "rop3-owner-conflict",
    );
  }

  if (!parentId) {
    const occupied = await occupiedCodeOwners(
      tx,
      [input.pgacCode, input.pgicCode].filter((code): code is string => Boolean(code)),
    );
    if (occupied.size > 0) {
      throw new AxIdentityRuleError(
        "A current-source AX code would collide with existing AX Online authority.",
        "code-collision",
      );
    }
    const parentRows = (await tx.execute(sql<{ id: string }>`
      insert into private.ax_identities (
        namespace, identity_kind, rop3_component,
        lifecycle_state, created_by_run_id
      ) values (
        ${AX_IDENTITY_NAMESPACE}, 'pgac', ${input.rop3},
        'reserved', ${input.runId}::uuid
      ) returning id
    `)) as unknown as { id: string }[];
    parentId = parentRows[0]!.id;
    await tx.execute(sql`
      insert into private.ax_identity_codes (
        identity_id, code, code_kind, lifecycle_state, created_by_run_id
      ) values (${parentId}::uuid, ${input.pgacCode}, 'canonical', 'reserved', ${input.runId}::uuid)
    `);
    await tx.execute(sql`
      insert into private.ax_identity_rop3_evidence (
        rop3, pgac_identity_id, identity_run_id, resource_version_id,
        resource_checksum, evidence_state, reserved_until
      ) values (
        ${input.rop3}, ${parentId}::uuid, ${input.runId}::uuid,
        ${input.ropVersionId}::uuid, ${input.ropChecksum}, 'reserved', ${input.reservedUntil}
      )
    `);
  }

  let bindingIdentityId = parentId;
  let pgicCode: string | null = null;
  if (input.iso3) {
    const childRows = (await tx.execute(sql<{ id: string; code: string }>`
      select child.id, code.code
      from private.ax_identities as child
      join private.ax_identity_codes as code
        on code.identity_id = child.id and code.code_kind = 'canonical'
       and code.lifecycle_state in ('reserved', 'active')
      where child.parent_identity_id = ${parentId}::uuid
        and child.normalized_iso3 = ${input.iso3}
        and child.lifecycle_state in ('reserved', 'active')
      limit 1
    `)) as unknown as Array<{ id: string; code: string }>;
    if (childRows[0]) {
      bindingIdentityId = childRows[0].id;
      pgicCode = childRows[0].code;
    } else {
      pgicCode = `${pgacCode}-${input.iso3}`;
      const occupied = await occupiedCodeOwners(tx, [pgicCode]);
      if (occupied.size > 0) {
        throw new AxIdentityRuleError(
          "The current ROP3 and ISO3 child code is owned by another identity.",
          "pgic-code-collision",
        );
      }
      const createdChildren = (await tx.execute(sql<{ id: string }>`
        insert into private.ax_identities (
          namespace, identity_kind, parent_identity_id, normalized_iso3,
          lifecycle_state, created_by_run_id
        ) values (
          ${AX_IDENTITY_NAMESPACE}, 'pgic', ${parentId}::uuid, ${input.iso3},
          'reserved', ${input.runId}::uuid
        ) returning id
      `)) as unknown as Array<{ id: string }>;
      bindingIdentityId = createdChildren[0]!.id;
      await tx.execute(sql`
        insert into private.ax_identity_codes (
          identity_id, code, code_kind, lifecycle_state, created_by_run_id
        ) values (
          ${bindingIdentityId}::uuid, ${pgicCode}, 'canonical', 'reserved', ${input.runId}::uuid
        )
      `);
    }
  }

  const bindingRows = (await tx.execute(sql<{ id: string }>`
    insert into private.ax_identity_source_bindings (
      source_profile_key, stable_row_key, identity_id, identity_run_id,
      binding_state, reserved_until, identity_evidence, evidence_checksum,
      supersedes_binding_id
    ) values (
      ${input.sourceProfileKey}, ${input.stableRowKey}, ${bindingIdentityId}::uuid,
      ${input.runId}::uuid, 'reserved', ${input.reservedUntil},
      ${JSON.stringify(input.identityEvidence)}::jsonb,
      ${identityEvidenceChecksum(input.identityEvidence)},
      ${input.supersedesBindingId ?? null}::uuid
    ) returning id
  `)) as unknown as { id: string }[];
  return {
    bindingId: bindingRows[0]!.id,
    identityId: bindingIdentityId,
    pgacCode,
    pgicCode,
  };
}

function enrichedRow(
  source: Record<string, string>,
  input: {
    runId: string;
    bindingId: string;
    pgacCode: string;
    pgicCode: string | null;
  },
) {
  return {
    ...stripSourceSuppliedAxCodes(source),
    AX_PGAC: input.pgacCode,
    ...(input.pgicCode ? { AX_PGIC: input.pgicCode } : {}),
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
  reviewRunId?: string;
}) {
  const publication = await getPipelinePublication(input.sourcePublicationId);
  if (!publication) throw new AxIdentityRegistryError("Formed publication not found.", 404);
  if (!publication.sourceProfileKey) {
    throw new AxIdentityRegistryError("The formed publication has no source profile.", 409);
  }
  const sourceProfileKey = publication.sourceProfileKey;
  const sourceDataset = await getDataset(publication.datasetId, {
    includeDisabled: true,
  });
  const sourceClassification = sourceDataset
    ? getDatasetClassification(sourceDataset.tags)
    : null;
  if (!sourceDataset || !sourceClassification) {
    throw new AxIdentityRegistryError(
      "The formed publication does not have a supported people-group classification.",
      409,
    );
  }
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
  const rop1ByRop3 = new Map<string, string | null>();
  for (const entry of ropResource.payload.entries) {
    if (entry.status !== "Active" || !entry.rop3) continue;
    const prior = rop1ByRop3.get(entry.rop3.code);
    const parent = entry.rop1?.code ?? null;
    if (prior !== undefined && prior !== parent) {
      throw new AxIdentityRegistryError(
        `The pinned ROP resource has conflicting ROP1 parents for ${entry.rop3.code}.`,
        409,
      );
    }
    rop1ByRop3.set(entry.rop3.code, parent);
  }
  const authority = await getAxIdentityAuthorityStatus();
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
  assertFreshIdentityAuthority({
    initialized: authority.initialized,
    authorityRevisionId: authority.registryRevisionId,
    baseRevisionId: input.baseRevisionId,
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
  const reviewedDecisions = input.reviewRunId
    ? (await getDb().execute(sql<{
        id: string;
        source_row_index: number;
        stable_row_key: string;
        current_binding_id: string;
        current_evidence: Record<string, unknown>;
        proposed_evidence: Record<string, unknown>;
        allowed_actions: AxIdentityChangeAction[];
        selected_action: AxIdentityChangeAction | null;
      }>`
        select decision.id, decision.source_row_index, decision.stable_row_key,
          decision.current_binding_id, decision.current_evidence,
          decision.proposed_evidence, decision.allowed_actions,
          decision.selected_action
        from private.ax_identity_change_decisions as decision
        join private.ax_identity_runs as review_run
          on review_run.id = decision.identity_run_id
        where review_run.id = ${input.reviewRunId}::uuid
          and review_run.source_publication_id = ${publication.id}::uuid
          and review_run.source_profile_key = ${sourceProfileKey}
        order by decision.source_row_index, decision.id
      `)) as unknown as Array<{
        id: string;
        source_row_index: number;
        stable_row_key: string;
        current_binding_id: string;
        current_evidence: Record<string, unknown>;
        proposed_evidence: Record<string, unknown>;
        allowed_actions: AxIdentityChangeAction[];
        selected_action: AxIdentityChangeAction | null;
      }>
    : [];
  if (input.reviewRunId && reviewedDecisions.length === 0) {
    throw new AxIdentityRegistryError(
      "The reviewed identity run has no applicable current-source decisions.",
      409,
    );
  }
  if (reviewedDecisions.some((decision) => decision.selected_action === null)) {
    throw new AxIdentityRegistryError(
      "Every identity-component change must be reviewed before rebuilding.",
      409,
    );
  }
  const reviewedDecisionByStableKey = new Map(
    reviewedDecisions.map((decision) => [decision.stable_row_key, decision]),
  );
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
    formatterChecksum: AX_IDENTITY_FORMATTER_CHECKSUM,
    resourceBindings,
    publicationTargetKey,
    expectedCurrentPublicationId,
    reviewedDecisions: reviewedDecisions.map((decision) => ({
      id: decision.id,
      stableRowKey: decision.stable_row_key,
      currentBindingId: decision.current_binding_id,
      proposedEvidence: decision.proposed_evidence,
      selectedAction: decision.selected_action,
    })),
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
          enrichedRow: stripSourceSuppliedAxCodes(source.data),
        });
        continue;
      }
      stableKeys.add(stableRowKey);

      try {
        const sourceName = textField(source.data, ["Data_Source", "data_source"]) ?? sourceProfileKey;
        const sourceInitials = normalizeSourceInitials(
          sourceName,
          sourceAliasBinding,
        );
        const sourceRop1 = normalizeRop1(
          textField(source.data, ["PG_ROP1", "ROP1", "rop1"]),
        );
        const rop3 = normalizeRop3(
          textField(source.data, ["PG_ROP3", "ROP3", "rop3"]),
          allowedRop3,
        );
        let rop1 = sourceRop1;
        if (rop3) {
          const resourceParent = rop1ByRop3.get(rop3) ?? null;
          if (!resourceParent) {
            throw new AxIdentityRuleError(
              "The current ROP3 has no valid ROP1 parent in the pinned ROP resource.",
              "missing-rop3-parent",
            );
          }
          if (sourceRop1 && sourceRop1 !== resourceParent) {
            throw new AxIdentityRuleError(
              "The formed ROP1 conflicts with the current ROP3 parent. Re-form the source with the pinned resource.",
              "formed-rop-parent-mismatch",
            );
          }
          rop1 = resourceParent;
        } else if (!rop1) {
          findings.push(
            warningFinding({
              ruleCode: "missing-rop1-and-rop3",
              sourceRowIndex: source.row_index,
              stableRowKey,
              message:
                "ROP1 and ROP3 are unavailable; the established 00 ROP1 component will remain visible in the new AX code.",
            }),
          );
        }
        const normalizedIso3 = normalizeOptionalIso3(
          textField(source.data, ["Geo_ISO3", "ISO3", "iso3"]),
          allowedIso3,
        );
        if (sourceClassification === "PGIC" && !normalizedIso3) {
          throw new AxIdentityRuleError(
            "PGIC identity assignment requires canonical ISO3 after country normalization.",
            "missing-canonical-iso3",
          );
        }
        const iso3 = sourceClassification === "PGIC" ? normalizedIso3 : null;
        const identityEvidence: CanonicalIdentityEvidence = {
          classification: sourceClassification,
          rop1,
          sourceInitials,
          rop3,
          iso3,
          countryVersionId: countryResource.version.id,
          countryChecksum: countryResource.version.contentChecksum!,
          ropVersionId: ropResource.version.id,
          ropChecksum: ropResource.version.contentChecksum!,
        };
        const evidenceChecksum = identityEvidenceChecksum(identityEvidence);
        const existing = await currentBinding(
          tx,
          sourceProfileKey,
          stableRowKey,
          runId,
          baseRevisionId,
        );
        let approvedChange: (typeof reviewedDecisions)[number] | null = null;
        let supersedesBindingId: string | null = null;
        if (existing) {
          if (existing.evidence_checksum === evidenceChecksum) {
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
          const reviewed = reviewedDecisionByStableKey.get(stableRowKey) ?? null;
          if (reviewed) {
            if (
              reviewed.current_binding_id !== existing.binding_id ||
              identityEvidenceChecksum(
                reviewed.current_evidence as CanonicalIdentityEvidence,
              ) !== identityEvidenceChecksum(
                existing.identity_evidence as CanonicalIdentityEvidence,
              ) ||
              identityEvidenceChecksum(
                reviewed.proposed_evidence as CanonicalIdentityEvidence,
              ) !== evidenceChecksum ||
              !reviewed.selected_action
            ) {
              throw new AxIdentityRuleError(
                "The approved identity decision no longer matches the current binding and normalized evidence.",
                "stale-identity-decision",
              );
            }
            approvedChange = reviewed;
            supersedesBindingId = existing.binding_id;
          } else {
          const decisionRows = (await tx.execute(sql<{ id: string }>`
            insert into private.ax_identity_change_decisions (
              identity_run_id, source_row_index, source_profile_key,
              stable_row_key, current_binding_id, current_evidence,
              proposed_evidence, allowed_actions
            ) values (
              ${runId}::uuid, ${source.row_index}, ${sourceProfileKey},
              ${stableRowKey}, ${existing.binding_id}::uuid,
              ${JSON.stringify(existing.identity_evidence)}::jsonb,
              ${JSON.stringify(identityEvidence)}::jsonb,
              array['rebind', 'new-identity', 'canonical-supersession']::text[]
            ) returning id
          `)) as unknown as Array<{ id: string }>;
          findings.push(
            errorFinding({
              ruleCode: "identity-component-change",
              sourceRowIndex: source.row_index,
              stableRowKey,
              message:
                "Current normalized identity evidence differs from the active binding and requires an explicit administrator decision.",
              details: {
                decisionId: decisionRows[0]!.id,
                currentEvidence: existing.identity_evidence,
                proposedEvidence: identityEvidence,
              },
            }),
          );
          rows.push({
            sourceRowIndex: source.row_index,
            stableRowKey,
            assignmentStatus: "review-required",
            bindingId: null,
            pgacCode: null,
            pgicCode: null,
            enrichedRow: stripSourceSuppliedAxCodes(source.data),
          });
          continue;
          }
        }

        let pgacCode: string;
        let pgicCode: string | null;
        let assignmentStatus: "reserved" | "pgac-only";
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
            allowPgacOnly: sourceClassification === "PGAC",
          });
          const decision = reconcileAxIdentity({
            existing: null,
            generatedPgac: generated.pgac,
            generatedPgic: generated.pgic,
          });
          const reservation = await reserveRop3Identity(tx, {
            runId,
            sourceProfileKey,
            stableRowKey,
            pgacCode: decision.pgacCode!,
            pgicCode: decision.pgicCode,
            rop3,
            iso3,
            ropVersionId: ropResource.version.id,
            ropChecksum: ropResource.version.contentChecksum!,
            identityEvidence,
            reservedUntil,
            supersedesBindingId,
            requireExistingOwner: approvedChange?.selected_action === "rebind",
            forbidExistingOwner: approvedChange?.selected_action === "new-identity",
            allowedExistingOwnerId:
              approvedChange?.selected_action === "canonical-supersession"
                ? existing?.pgac_identity_id ?? null
                : undefined,
          });
          if (
            approvedChange?.selected_action === "canonical-supersession" &&
            reservation.identityId === existing?.identity_id
          ) {
            throw new AxIdentityRuleError(
              "The proposed canonical identity is unchanged; select rebind to retain the identity with reviewed evidence.",
              "canonical-supersession-unchanged",
            );
          }
          bindingId = reservation.bindingId;
          pgacCode = reservation.pgacCode;
          pgicCode = reservation.pgicCode;
          assignmentStatus = pgicCode ? "reserved" : "pgac-only";
        } else {
          if (approvedChange?.selected_action === "rebind") {
            throw new AxIdentityRuleError(
              "Rebinding requires an exact current ROP3 identity owner.",
              "rebind-requires-rop3",
            );
          }
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
              enrichedRow: stripSourceSuppliedAxCodes(source.data),
            });
            continue;
          }
          const allocationRows = (await tx.execute(sql<{
            binding_id: string;
            identity_id: string;
            allocated_value: number;
            pgac_code: string;
            pgic_code: string | null;
            reused: boolean;
          }>`
            select * from private.allocate_ax_identity_value(
              ${AX_IDENTITY_NAMESPACE}, ${sourceProfileKey}, ${stableRowKey},
              ${runId}::uuid, ${rop1}, ${sourceInitials}, ${iso3}, ${reservedUntil},
              ${JSON.stringify(identityEvidence)}::jsonb, ${evidenceChecksum},
              ${supersedesBindingId}::uuid
            )
          `)) as unknown as Array<{
            binding_id: string;
            identity_id: string;
            allocated_value: number;
            pgac_code: string;
            pgic_code: string | null;
            reused: boolean;
          }>;
          const allocation = allocationRows[0]!;
          bindingId = allocation.binding_id;
          pgacCode = allocation.pgac_code;
          pgicCode = allocation.pgic_code;
          assignmentStatus = pgicCode ? "reserved" : "pgac-only";
        }

        if (approvedChange && existing) {
          await tx.execute(sql`
            insert into private.ax_identity_change_decisions (
              identity_run_id, source_row_index, source_profile_key,
              stable_row_key, current_binding_id, current_evidence,
              proposed_evidence, allowed_actions, selected_action,
              selected_by_owner_id, selected_by_email, selected_at
            ) values (
              ${runId}::uuid, ${source.row_index}, ${sourceProfileKey},
              ${stableRowKey}, ${existing.binding_id}::uuid,
              ${JSON.stringify(existing.identity_evidence)}::jsonb,
              ${JSON.stringify(identityEvidence)}::jsonb,
              ${approvedChange.allowed_actions}::text[],
              ${approvedChange.selected_action}, ${input.identity.ownerId},
              ${input.identity.email}, now()
            )
          `);
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
          enrichedRow: stripSourceSuppliedAxCodes(source.data),
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
      reserved: rows.filter((row) =>
        row.assignmentStatus === "reserved" || row.assignmentStatus === "pgac-only"
      ).length,
      conflict: rows.filter((row) =>
        row.assignmentStatus === "conflict" || row.assignmentStatus === "review-required"
      ).length,
      unassignable: rows.filter((row) => row.assignmentStatus === "unassignable").length,
    };
    await tx.execute(sql`
      update private.ax_identity_runs set
        output_row_count = ${rows.length}, reused_count = ${counts.reused},
        retained_count = 0, reserved_count = ${counts.reserved},
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

export async function reviewAxIdentityChangeDecision(input: {
  runId: string;
  decisionId: string;
  action: AxIdentityChangeAction;
  identity: CurrentIdentity;
}) {
  await getDb().transaction(async (tx) => {
    const rows = (await tx.execute(sql<{
      selected_action: AxIdentityChangeAction | null;
      allowed_actions: AxIdentityChangeAction[];
      status: string;
    }>`
      select decision.selected_action, decision.allowed_actions, run.status
      from private.ax_identity_change_decisions as decision
      join private.ax_identity_runs as run on run.id = decision.identity_run_id
      where decision.id = ${input.decisionId}::uuid
        and decision.identity_run_id = ${input.runId}::uuid
      for update of decision
    `)) as unknown as Array<{
      selected_action: AxIdentityChangeAction | null;
      allowed_actions: AxIdentityChangeAction[];
      status: string;
    }>;
    const decision = rows[0];
    if (!decision) {
      throw new AxIdentityRegistryError("Identity change decision not found.", 404);
    }
    if (decision.status !== "invalid") {
      throw new AxIdentityRegistryError(
        "Only an invalid reviewed candidate can accept identity change decisions.",
        409,
      );
    }
    if (decision.selected_action) {
      throw new AxIdentityRegistryError(
        "This identity change decision is already immutable.",
        409,
      );
    }
    if (!decision.allowed_actions.includes(input.action)) {
      throw new AxIdentityRegistryError(
        "The selected identity change action is not allowed.",
        409,
      );
    }
    await tx.execute(sql`
      update private.ax_identity_change_decisions
      set selected_action = ${input.action},
        selected_by_owner_id = ${input.identity.ownerId},
        selected_by_email = ${input.identity.email}, selected_at = now()
      where id = ${input.decisionId}::uuid
        and identity_run_id = ${input.runId}::uuid
        and selected_action is null
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
  const sourcePublication = await getPipelinePublication(
    evidence.run.sourcePublicationId,
  );
  const sourceDataset = sourcePublication
    ? await getDataset(sourcePublication.datasetId, { includeDisabled: true })
    : null;
  const sourceClassification = sourceDataset
    ? getDatasetClassification(sourceDataset.tags)
    : null;
  if (!sourceDataset || !sourceClassification) {
    throw new AxIdentityRegistryError(
      "The source dataset classification is unavailable for identity publication.",
      409,
    );
  }
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
      classification: sourceClassification,
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
  const [authority, bindings, revisions, runs] = await Promise.all([
    getAxIdentityAuthorityStatus(),
    listActiveIdentityBindings(),
    listIdentityRegistryRevisions(),
    listAxIdentityRuns(),
  ]);
  return { authority, bindings, revisions, runs };
}
