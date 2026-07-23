import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { sql, type SQL } from "drizzle-orm";

import { getDb } from "@/db";
import type { CsvColumn } from "@/lib/api-types";
import { publishPreparedDataset } from "@/lib/datasets";
import { serializePipelineRowsCsv } from "@/lib/pipeline-products/artifacts";
import {
  deletePipelineArtifacts,
  deletePipelineDatasetBlob,
  readPipelineArtifact,
  uploadPipelineArtifact,
  uploadPipelineDatasetBlob,
} from "@/lib/pipeline-products/storage";
import { inferTier1ReleaseInputKey } from "@/lib/pipeline-products/release-sets";
import { checksumSourceFormingValue } from "@/lib/source-forming/canonical";

import { listTier2PartnerProfiles, listTier2StableTargets } from "./admin";
import {
  assertTier2ProductArtifactEnvelope,
  assertTier2ProductArtifactEvidence,
  persistTier2ProductArtifacts,
} from "./artifacts";
import {
  createTier2ProductInputFingerprint,
  getTier2ProductDefinitionContract,
} from "./definitions";
import { compareTier2CandidateWithLegacy } from "./comparison";
import { Tier2ProductError } from "./errors";
import {
  buildAggregate2Candidate,
  buildTier2ReleaseCandidate,
} from "./releases";
import { getTier2RevisionCompatibilityIssues } from "./revision-compatibility";
import type {
  Aggregate2InputPublications,
  Tier2PartnerPublication,
  Tier2ProductCandidate,
  Tier2ProductKind,
  Tier2ProductPublicationSnapshot,
  Tier2ReleaseFinding,
} from "./types";

export type Tier2ReleaseMemberSelection = Readonly<{
  inputKey: string;
  publicationId: string;
  expectedChecksum: string;
}>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type CreateTier2ProductReleaseInput = Readonly<{
  productKind: Tier2ProductKind;
  resourceSetId: string;
  registryRevisionId: string;
  expectedCurrentPublicationId?: string | null;
  members: readonly Tier2ReleaseMemberSelection[];
  actorOwnerId: string;
  actorEmail: string | null;
  reason: string;
}>;

export function assertTier2ProductCandidateTargetCurrent(input: {
  productKind: Tier2ProductKind;
  expectedCurrentPublicationId: string | null;
  currentPublicationId: string | null;
}) {
  if (input.expectedCurrentPublicationId !== input.currentPublicationId) {
    throw new Tier2ProductError(
      `The ${input.productKind === "tier2" ? "Tier 2" : "Aggregate 2"} stable target advanced after this candidate was built.`,
      409,
      "publication-target-changed",
    );
  }
}

export function assertTier2RollbackSnapshot(input: {
  columns: readonly CsvColumn[];
  rows: readonly Record<string, string>[];
  expectedRowCount: number;
  expectedOutputChecksum: string;
}) {
  if (
    input.rows.length !== input.expectedRowCount ||
    checksumSourceFormingValue({
      columns: input.columns,
      rows: input.rows,
    }) !== input.expectedOutputChecksum
  ) {
    throw new Tier2ProductError(
      "The selected rollback publication no longer matches its immutable rows and checksum.",
      409,
      "rollback-publication-evidence-mismatch",
    );
  }
}

type PublicationRow = {
  id: string;
  producer_kind: string;
  producer_run_id: string;
  source_profile_key: string | null;
  registry_revision_id: string | null;
  output_checksum: string;
  row_count: number;
  publication_target_key: string | null;
  created_at: Date | string;
};

type DefinitionRow = {
  definition_key: string;
  stage: "tier2-union" | "aggregate2";
  display_name: string;
  version: string;
  checksum: string;
  publication_target_key: string;
  is_workspace_visible: boolean;
};

type RunRow = {
  id: string;
  definition_key: string;
  display_name: string;
  stage: "tier2-union" | "aggregate2";
  definition_version: string;
  definition_checksum: string;
  release_set_id: string;
  status: string;
  input_fingerprint: string;
  input_row_count: number;
  output_row_count: number | null;
  warning_count: number;
  error_count: number;
  output_checksum: string | null;
  validation_summary: Record<string, unknown>;
  artifact_manifest: Record<string, unknown>;
  dataset_id: string | null;
  publication_id: string | null;
  expected_current_publication_id: string | null;
  publication_target_key: string;
  rejection_reason: string | null;
  publication_reason: string | null;
  created_at: Date | string;
  completed_at: Date | string | null;
  legacy_comparison_available: boolean;
};

function iso(value: Date | string | null) {
  return value === null ? null : new Date(value).toISOString();
}

function columnsForRows(rows: readonly Readonly<Record<string, string>>[]) {
  return [...new Set(rows.flatMap((row) => Object.keys(row)))]
    .sort()
    .map((key, sourceIndex) => ({ key, label: key, sourceIndex }));
}

async function getDefinition(productKind: Tier2ProductKind) {
  const contract = getTier2ProductDefinitionContract(productKind);
  const key = contract.definitionKey;
  const rows = (await getDb().execute(sql<DefinitionRow>`
    select definition_key, stage, display_name, version, checksum,
      publication_target_key, is_workspace_visible
    from private.pipeline_definitions
    where definition_key = ${key} and active
    limit 1
  `)) as unknown as DefinitionRow[];
  if (!rows[0]) {
    throw new Tier2ProductError(
      "The Tier 2 product definition is not active.",
      409,
      "definition-not-active",
    );
  }
  if (
    rows[0].version !== contract.version ||
    rows[0].checksum !== contract.checksum ||
    rows[0].stage !== contract.stage ||
    rows[0].display_name !== contract.displayName ||
    rows[0].publication_target_key !== contract.publicationTargetKey ||
    rows[0].is_workspace_visible !== contract.isWorkspaceVisible
  ) {
    throw new Tier2ProductError(
      "The active Tier 2 product definition does not match the checked-in semantic contract.",
      409,
      "definition-contract-drift",
    );
  }
  return rows[0];
}

async function loadPublications(selections: readonly Tier2ReleaseMemberSelection[]) {
  const ids = selections.map((member) => member.publicationId);
  if (new Set(ids).size !== ids.length) {
    throw new Tier2ProductError(
      "Each release member must select a distinct publication.",
      400,
      "duplicate-publication-selection",
    );
  }
  const rows = (await getDb().execute(sql<PublicationRow>`
    select id, producer_kind, producer_run_id, source_profile_key, registry_revision_id,
      output_checksum, row_count, publication_target_key, created_at
    from private.pipeline_publications
    where id in (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})
    order by id
  `)) as unknown as PublicationRow[];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const loaded = [];
  for (const selection of selections) {
    const publication = byId.get(selection.publicationId);
    if (!publication) {
      throw new Tier2ProductError(
        `Publication ${selection.publicationId} no longer exists.`,
        409,
        "missing-publication",
      );
    }
    if (publication.output_checksum !== selection.expectedChecksum) {
      throw new Tier2ProductError(
        `The ${selection.inputKey} publication checksum changed before review completed.`,
        409,
        "stale-publication-checksum",
      );
    }
    const rowRecords = (await getDb().execute(sql<{
      row_index: number;
      data: Record<string, string>;
    }>`
      select row_index, data
      from private.pipeline_publication_rows
      where publication_id = ${publication.id}::uuid
      order by row_index
    `)) as unknown as Array<{ row_index: number; data: Record<string, string> }>;
    if (rowRecords.length !== publication.row_count) {
      throw new Tier2ProductError(
        `The ${selection.inputKey} publication row archive is incomplete.`,
        409,
        "incomplete-publication-archive",
      );
    }
    loaded.push({
      selection,
      publication,
      rows: rowRecords.map((row) => row.data),
    });
  }
  return loaded;
}

function requireExactKeys(
  actual: readonly string[],
  expected: readonly string[],
) {
  if (new Set(actual).size !== actual.length) {
    throw new Tier2ProductError(
      "Each release input key may be selected only once.",
      400,
      "duplicate-release-input",
    );
  }
  if (
    actual.length !== expected.length ||
    expected.some((key, index) => actual[index] !== key)
  ) {
    throw new Tier2ProductError(
      `The release requires exactly ${expected.join(", ")} in that order.`,
      400,
      "incomplete-release",
      { expected, actual },
    );
  }
}

async function assertTier2ReleaseRevisionCompatibility(input: {
  selectedRevisionId: string;
  loaded: Awaited<ReturnType<typeof loadPublications>>;
}) {
  const selectedRows = (await getDb().execute(sql<{
    revision_number: number;
    binding_ids: string[];
  }>`
    select revision.revision_number,
      coalesce(array_agg(binding.binding_id::text order by binding.binding_id)
        filter (where binding.binding_id is not null), array[]::text[]) as binding_ids
    from private.ax_registry_revisions as revision
    left join private.ax_registry_revision_bindings as binding
      on binding.revision_id = revision.id
    where revision.id = ${input.selectedRevisionId}::uuid
    group by revision.id, revision.revision_number
  `)) as unknown as Array<{ revision_number: number; binding_ids: string[] }>;
  if (!selectedRows[0]) {
    throw new Tier2ProductError(
      "The selected AX registry revision no longer exists.",
      409,
      "missing-registry-revision",
    );
  }
  const lineage = [];
  for (const member of input.loaded) {
    const rows = (await getDb().execute(sql<{
      publication_id: string;
      origin_revision_number: number | null;
      binding_ids: string[];
    }>`
      with recursive publication_lineage as (
        select publication.id as publication_id, publication.producer_kind,
          publication.producer_run_id, publication.registry_revision_id
        from private.pipeline_publications as publication
        where publication.id = ${member.publication.id}::uuid
        union
        select child.id, child.producer_kind, child.producer_run_id,
          child.registry_revision_id
        from publication_lineage as parent
        join private.pipeline_publication_inputs as lineage_input
          on lineage_input.publication_id = parent.publication_id
        join private.pipeline_publications as child
          on child.id = lineage_input.input_publication_id
      )
      select lineage.publication_id,
        origin.revision_number as origin_revision_number,
        coalesce(array_agg(distinct run_row.binding_id::text)
          filter (where run_row.binding_id is not null), array[]::text[]) as binding_ids
      from publication_lineage as lineage
      left join private.ax_registry_revisions as origin
        on origin.id = lineage.registry_revision_id
      left join private.ax_identity_run_rows as run_row
        on lineage.producer_kind = 'identity'
        and run_row.identity_run_id = lineage.producer_run_id
      group by lineage.publication_id, origin.revision_number
      order by lineage.publication_id
    `)) as unknown as Array<{
      publication_id: string;
      origin_revision_number: number | null;
      binding_ids: string[];
    }>;
    lineage.push(...rows.map((row) => ({
      inputKey: member.selection.inputKey,
      publicationId: row.publication_id,
      originRevisionNumber: row.origin_revision_number === null
        ? null
        : Number(row.origin_revision_number),
      bindingIds: row.binding_ids,
    })));
  }
  const issues = getTier2RevisionCompatibilityIssues({
    selectedRevisionNumber: Number(selectedRows[0].revision_number),
    selectedBindingIds: new Set(selectedRows[0].binding_ids),
    lineage,
  });
  if (issues.length > 0) {
    const missingBinding = issues.some((issue) => issue.code === "missing-binding");
    throw new Tier2ProductError(
      missingBinding
        ? "The selected AX registry revision does not contain every exact release identity binding."
        : "The selected AX registry revision predates an exact release publication.",
      409,
      missingBinding ? "registry-binding-mismatch" : "registry-revision-too-old",
      { issues },
    );
  }
}

function buildCandidate(input: {
  productKind: Tier2ProductKind;
  requiredProfileKeys: readonly string[];
  partnerKeys: ReadonlyMap<string, string>;
  loaded: Awaited<ReturnType<typeof loadPublications>>;
}) {
  if (input.productKind === "tier2") {
    requireExactKeys(
      input.loaded.map((member) => member.selection.inputKey),
      input.requiredProfileKeys,
    );
    const publications: Tier2PartnerPublication[] = input.loaded.map((member) => {
      if (
        member.publication.producer_kind !== "identity" ||
        member.publication.source_profile_key !== member.selection.inputKey
      ) {
        throw new Tier2ProductError(
          `The ${member.selection.inputKey} member is not its published identity output.`,
          409,
          "incompatible-partner-publication",
        );
      }
      return {
        publicationId: member.publication.id,
        profileKey: member.selection.inputKey,
        partnerKey: input.partnerKeys.get(member.selection.inputKey) ?? member.selection.inputKey,
        registryRevisionId: member.publication.registry_revision_id!,
        outputChecksum: member.publication.output_checksum,
        publishedAt: iso(member.publication.created_at)!,
        columns: columnsForRows(member.rows),
        rows: member.rows,
      };
    });
    return buildTier2ReleaseCandidate({
      definition: {
        key: "tier2-complete-partners",
        version: "v1",
        requiredProfileKeys: input.requiredProfileKeys,
      },
      publications,
    });
  }

  const aggregateKeys = ["tier2", "imb", "jp"] as const;
  requireExactKeys(
    input.loaded.map((member) => member.selection.inputKey),
    aggregateKeys,
  );
  const snapshots = Object.fromEntries(input.loaded.map((member) => {
    if (member.selection.inputKey === "tier2") {
      if (
        member.publication.producer_kind !== "tier2-merge" ||
        member.publication.publication_target_key !== "tier2-pgic"
      ) {
        throw new Tier2ProductError(
          "Aggregate 2 requires an exact published Tier 2 Combined Release.",
          409,
          "incompatible-tier2-publication",
        );
      }
    } else if (
      member.publication.producer_kind !== "identity" ||
      inferTier1ReleaseInputKey(member.publication.source_profile_key) !==
        member.selection.inputKey
    ) {
      throw new Tier2ProductError(
        `Aggregate 2 ${member.selection.inputKey.toUpperCase()} must be a compatible identity publication.`,
        409,
        "incompatible-supplement-publication",
      );
    }
    const snapshot: Tier2ProductPublicationSnapshot = {
      publicationId: member.publication.id,
      outputChecksum: member.publication.output_checksum,
      columns: columnsForRows(member.rows),
      rows: member.rows,
    };
    return [member.selection.inputKey, snapshot];
  })) as Aggregate2InputPublications;
  return buildAggregate2Candidate(snapshots);
}

function mapRun(row: RunRow, outOfDate: {
  outOfDate: boolean;
  changedInputs: readonly string[];
}) {
  return {
    id: row.id,
    productKind: row.stage === "tier2-union" ? "tier2" as const : "aggregate2" as const,
    definitionKey: row.definition_key,
    displayName: row.display_name,
    definitionVersion: row.definition_version,
    definitionChecksum: row.definition_checksum,
    releaseSetId: row.release_set_id,
    status: row.status,
    inputFingerprint: row.input_fingerprint,
    inputRowCount: row.input_row_count,
    outputRowCount: row.output_row_count,
    warningCount: row.warning_count,
    errorCount: row.error_count,
    outputChecksum: row.output_checksum,
    artifactManifest: row.artifact_manifest ?? {},
    datasetId: row.dataset_id,
    publicationId: row.publication_id,
    expectedCurrentPublicationId: row.expected_current_publication_id,
    publicationTargetKey: row.publication_target_key,
    rejectionReason: row.rejection_reason,
    publicationReason: row.publication_reason,
    outOfDate: outOfDate.outOfDate,
    changedInputs: outOfDate.changedInputs,
    legacyComparisonAvailable: row.legacy_comparison_available,
    createdAt: iso(row.created_at)!,
    completedAt: iso(row.completed_at),
  };
}

async function readRunRows(where: SQL, limit?: number) {
  return (await getDb().execute(sql<RunRow>`
    select run.id, run.definition_key, definition.display_name, definition.stage,
      run.definition_version, run.release_set_id, run.status,
      run.definition_checksum,
      run.input_fingerprint, run.input_row_count, run.output_row_count,
      run.warning_count, run.error_count, run.output_checksum,
      run.validation_summary, run.artifact_manifest, run.dataset_id, run.publication_id,
      run.expected_current_publication_id,
      definition.publication_target_key, run.rejection_reason,
      run.publication_reason, run.created_at, run.completed_at,
      exists (
        select 1 from private.pipeline_artifacts as comparison
        where comparison.run_id = run.id
          and comparison.artifact_kind = 'comparison-json'
      ) as legacy_comparison_available
    from private.pipeline_runs as run
    join private.pipeline_definitions as definition
      on definition.definition_key = run.definition_key
    where definition.stage in ('tier2-union', 'aggregate2') and ${where}
    order by run.created_at desc, run.id desc
    ${limit ? sql`limit ${limit}` : sql``}
  `)) as unknown as RunRow[];
}

export async function getTier2RunOutOfDateState(runId: string) {
  const rows = (await getDb().execute(sql<{
    stage: "tier2-union" | "aggregate2";
    input_key: string;
    publication_id: string;
    source_profile_key: string | null;
  }>`
    select definition.stage, member.input_key, member.publication_id,
      publication.source_profile_key
    from private.pipeline_runs as run
    join private.pipeline_definitions as definition
      on definition.definition_key = run.definition_key
    join private.pipeline_release_members as member
      on member.release_set_id = run.release_set_id
    join private.pipeline_publications as publication
      on publication.id = member.publication_id
    where run.id = ${runId}::uuid
    order by member.position
  `)) as unknown as Array<{
    stage: "tier2-union" | "aggregate2";
    input_key: string;
    publication_id: string;
    source_profile_key: string | null;
  }>;
  if (rows.length === 0) return { outOfDate: false, changedInputs: [] as string[] };

  const changedInputs: string[] = [];
  const targets = await listTier2StableTargets();
  for (const member of rows) {
    if (member.stage === "aggregate2" && member.input_key === "tier2") {
      const currentTier2 = targets.find((target) => target.productKind === "tier2")
        ?.currentPublicationId;
      if (currentTier2 && currentTier2 !== member.publication_id) {
        changedInputs.push(member.input_key);
      }
      continue;
    }
    if (!member.source_profile_key) continue;
    const latest = (await getDb().execute(sql<{ id: string }>`
      select id from private.pipeline_publications
      where producer_kind = 'identity'
        and source_profile_key = ${member.source_profile_key}
      order by created_at desc, id desc
      limit 1
    `)) as unknown as { id: string }[];
    if (latest[0] && latest[0].id !== member.publication_id) {
      changedInputs.push(member.input_key);
    }
  }
  return { outOfDate: changedInputs.length > 0, changedInputs };
}

export async function listTier2ProductRuns(limit = 100) {
  const rows = await readRunRows(sql`true`, Math.max(1, Math.min(250, limit)));
  return Promise.all(rows.map(async (row) => mapRun(
    row,
    await getTier2RunOutOfDateState(row.id),
  )));
}

export async function getTier2ProductRun(runId: string) {
  const rows = await readRunRows(sql`run.id = ${runId}::uuid`, 1);
  if (!rows[0]) return null;
  const [outOfDate, findings, members] = await Promise.all([
    getTier2RunOutOfDateState(runId),
    getDb().execute(sql<{
      severity: "warning" | "error";
      rule_code: string;
      message: string;
      details: Record<string, unknown>;
    }>`
      select severity, rule_code, message, details
      from private.pipeline_findings
      where run_id = ${runId}::uuid
      order by id
    `) as unknown as Promise<Array<{
      severity: "warning" | "error";
      rule_code: string;
      message: string;
      details: Record<string, unknown>;
    }>>,
    getDb().execute(sql<{
      position: number;
      input_key: string;
      publication_id: string;
      publication_checksum: string;
      publication_row_count: number;
    }>`
      select position, input_key, publication_id, publication_checksum,
        publication_row_count
      from private.pipeline_run_inputs
      where run_id = ${runId}::uuid
      order by position
    `) as unknown as Promise<Array<{
      position: number;
      input_key: string;
      publication_id: string;
      publication_checksum: string;
      publication_row_count: number;
    }>>,
  ]);
  return {
    ...mapRun(rows[0], outOfDate),
    validationSummary: rows[0].validation_summary ?? {},
    findings: findings.map((finding) => ({
      severity: finding.severity,
      ruleCode: finding.rule_code,
      message: finding.message,
      details: finding.details ?? {},
    })),
    members: members.map((member) => ({
      position: member.position,
      inputKey: member.input_key,
      publicationId: member.publication_id,
      outputChecksum: member.publication_checksum,
      rowCount: member.publication_row_count,
    })),
  };
}

function legacyComparisonColumns(value: unknown): CsvColumn[] {
  if (
    !Array.isArray(value) ||
    value.some((column) =>
      !column ||
      typeof column !== "object" ||
      Array.isArray(column) ||
      typeof (column as Record<string, unknown>).key !== "string" ||
      typeof (column as Record<string, unknown>).label !== "string" ||
      !Number.isInteger((column as Record<string, unknown>).sourceIndex)
    )
  ) {
    throw new Tier2ProductError(
      "The Tier 2 candidate has no immutable columns for legacy comparison.",
      409,
      "comparison-columns-missing",
    );
  }
  return value.map((column) => ({
    key: (column as Record<string, unknown>).key as string,
    label: (column as Record<string, unknown>).label as string,
    sourceIndex: Number((column as Record<string, unknown>).sourceIndex),
  }));
}

export type Tier2LegacyComparisonArtifact = Readonly<{
  schemaVersion: 1;
  runId: string;
  productKind: Tier2ProductKind;
  definitionKey: string;
  reason: string;
  createdByOwnerId: string;
  createdByEmail: string | null;
  createdAt: string;
  report: ReturnType<typeof compareTier2CandidateWithLegacy>;
}>;

export async function createTier2LegacyComparison(input: {
  runId: string;
  legacy: {
    columns: readonly CsvColumn[];
    rows: readonly Record<string, string>[];
  };
  reason: string;
  actorOwnerId: string;
  actorEmail: string | null;
}) {
  if (!input.reason.trim()) {
    throw new Tier2ProductError(
      "A legacy comparison reason is required.",
      400,
      "comparison-reason-missing",
    );
  }
  const run = await getTier2ProductRun(input.runId);
  if (
    !run ||
    !["valid", "invalid", "published", "rejected"].includes(run.status) ||
    !run.outputChecksum ||
    run.outputRowCount === null
  ) {
    throw new Tier2ProductError(
      "A completed Tier 2 or Aggregate 2 candidate is required for comparison.",
      409,
      "comparison-run-not-ready",
    );
  }
  if (run.legacyComparisonAvailable) {
    throw new Tier2ProductError(
      "This candidate already has an immutable legacy comparison report.",
      409,
      "comparison-already-retained",
    );
  }
  const candidateRows = (await getDb().execute(sql<{
    row_index: number;
    data: Record<string, string>;
  }>`
    select row_index, data
    from private.tier2_pipeline_run_rows
    where run_id = ${input.runId}::uuid
    order by row_index
  `)) as unknown as Array<{
    row_index: number;
    data: Record<string, string>;
  }>;
  const candidate = {
    columns: legacyComparisonColumns(run.validationSummary.columns),
    rows: candidateRows.map((row) => row.data),
  };
  if (
    candidate.rows.length !== run.outputRowCount ||
    checksumSourceFormingValue(candidate) !== run.outputChecksum
  ) {
    throw new Tier2ProductError(
      "The retained candidate rows no longer match their reviewed checksum.",
      409,
      "comparison-candidate-evidence-mismatch",
    );
  }
  const artifact: Tier2LegacyComparisonArtifact = {
    schemaVersion: 1,
    runId: run.id,
    productKind: run.productKind,
    definitionKey: run.definitionKey,
    reason: input.reason.trim(),
    createdByOwnerId: input.actorOwnerId,
    createdByEmail: input.actorEmail,
    createdAt: new Date().toISOString(),
    report: compareTier2CandidateWithLegacy({
      legacy: input.legacy,
      candidate,
    }),
  };
  const body = JSON.stringify(artifact);
  const storagePath = await uploadPipelineArtifact({
    definitionKey: run.definitionKey,
    runId: run.id,
    kind: "comparison-json",
    body,
  });
  try {
    await getDb().transaction(async (tx) => {
      await tx.execute(sql`
        select pg_advisory_xact_lock(
          hashtextextended(${`tier2-legacy-comparison:${run.id}`}, 0)
        )
      `);
      const current = (await tx.execute(sql<{
        status: string;
        output_row_count: number | null;
        output_checksum: string | null;
      }>`
        select status, output_row_count, output_checksum
        from private.pipeline_runs
        where id = ${run.id}::uuid
        for share
      `)) as unknown as Array<{
        status: string;
        output_row_count: number | null;
        output_checksum: string | null;
      }>;
      if (
        !current[0] ||
        current[0].status !== run.status ||
        current[0].output_row_count !== run.outputRowCount ||
        current[0].output_checksum !== run.outputChecksum
      ) {
        throw new Tier2ProductError(
          "The Tier 2 candidate changed while its legacy comparison was being retained.",
          409,
          "comparison-run-changed",
        );
      }
      await tx.execute(sql`
        insert into private.pipeline_artifacts (
          run_id, artifact_kind, storage_path, content_checksum,
          size_bytes, schema_version
        ) values (
          ${run.id}::uuid, 'comparison-json', ${storagePath},
          ${checksumSourceFormingValue(body)},
          ${Buffer.byteLength(body, "utf8")}, 1
        )
      `);
    });
  } catch (error) {
    await deletePipelineArtifacts([storagePath]).catch(() => undefined);
    throw error;
  }
  return artifact;
}

export async function getTier2LegacyComparison(runId: string) {
  const rows = (await getDb().execute(sql<{
    storage_path: string;
    content_checksum: string;
    size_bytes: number;
  }>`
    select storage_path, content_checksum, size_bytes
    from private.pipeline_artifacts
    where run_id = ${runId}::uuid
      and artifact_kind = 'comparison-json'
    limit 1
  `)) as unknown as Array<{
    storage_path: string;
    content_checksum: string;
    size_bytes: number;
  }>;
  if (!rows[0]) return null;
  const body = await readPipelineArtifact(rows[0].storage_path);
  if (
    checksumSourceFormingValue(body) !== rows[0].content_checksum ||
    Buffer.byteLength(body, "utf8") !== rows[0].size_bytes
  ) {
    throw new Tier2ProductError(
      "The retained legacy comparison no longer matches its immutable audit record.",
      409,
      "comparison-artifact-mismatch",
    );
  }
  const artifact = JSON.parse(body) as Tier2LegacyComparisonArtifact;
  if (
    artifact.schemaVersion !== 1 ||
    artifact.runId !== runId ||
    artifact.report?.schemaVersion !== 1
  ) {
    throw new Tier2ProductError(
      "The retained legacy comparison has an unsupported shape.",
      409,
      "comparison-artifact-invalid",
    );
  }
  return { artifact, body };
}

export async function listEligibleTier2Publications(limit = 250) {
  const profiles = await listTier2PartnerProfiles();
  const profileKeys = new Set(profiles.filter((profile) => profile.active).map((profile) => profile.profileKey));
  const rows = (await getDb().execute(sql<PublicationRow & { actual_row_count: number }>`
    select publication.id, publication.producer_kind, publication.producer_run_id,
      publication.source_profile_key, publication.registry_revision_id,
      publication.output_checksum, publication.row_count,
      publication.publication_target_key, publication.created_at,
      (select count(*)::integer from private.pipeline_publication_rows as archived
       where archived.publication_id = publication.id) as actual_row_count
    from private.pipeline_publications as publication
    where publication.producer_kind in ('identity', 'tier2-merge')
    order by publication.created_at desc, publication.id desc
    limit ${Math.max(1, Math.min(500, limit))}
  `)) as unknown as Array<PublicationRow & { actual_row_count: number }>;
  return rows.map((row) => {
    const inferred = inferTier1ReleaseInputKey(row.source_profile_key);
    const eligibleInputKeys = [
      ...(row.source_profile_key && profileKeys.has(row.source_profile_key)
        ? [row.source_profile_key]
        : []),
      ...(row.producer_kind === "tier2-merge" && row.publication_target_key === "tier2-pgic"
        ? ["tier2"]
        : []),
      ...(inferred === "imb" || inferred === "jp" ? [inferred] : []),
    ];
    return {
      id: row.id,
      producerKind: row.producer_kind,
      sourceProfileKey: row.source_profile_key,
      registryRevisionId: row.registry_revision_id,
      outputChecksum: row.output_checksum,
      rowCount: row.row_count,
      rowsPresent: row.actual_row_count === row.row_count,
      publicationTargetKey: row.publication_target_key,
      eligibleInputKeys,
      createdAt: iso(row.created_at)!,
    };
  }).filter((row) => row.eligibleInputKeys.length > 0);
}

export async function createTier2ProductRelease(input: CreateTier2ProductReleaseInput) {
  if (!input.reason.trim()) {
    throw new Tier2ProductError("A release reason is required.", 400, "missing-reason");
  }
  const hasExpectedCurrentPublicationPin = Object.prototype.hasOwnProperty.call(
    input,
    "expectedCurrentPublicationId",
  );
  if (
    hasExpectedCurrentPublicationPin &&
    input.expectedCurrentPublicationId !== null &&
    (
      typeof input.expectedCurrentPublicationId !== "string" ||
      !UUID_PATTERN.test(input.expectedCurrentPublicationId)
    )
  ) {
    throw new Tier2ProductError(
      "The expected current Tier 2 publication pin is invalid.",
      400,
      "publication-target-pin-invalid",
    );
  }
  const targetRowsPromise: Promise<
    Array<{ current_publication_id: string | null }>
  > = hasExpectedCurrentPublicationPin
    ? Promise.resolve(getDb().execute(sql<{ product_kind: string }>`
        select product_kind
        from private.tier2_publication_targets
        where product_kind = ${input.productKind}
        limit 1
      `) as unknown as Promise<Array<{ product_kind: string }>>)
        .then((rows) =>
          rows[0]
            ? [{
                current_publication_id:
                  input.expectedCurrentPublicationId ?? null,
              }]
            : []
        )
    : getDb().execute(sql<{ current_publication_id: string | null }>`
        select current_publication_id
        from private.tier2_publication_targets
        where product_kind = ${input.productKind}
        limit 1
      `) as unknown as Promise<
        Array<{ current_publication_id: string | null }>
      >;
  const [definition, profiles, loaded, bindingRows, targetRows] = await Promise.all([
    getDefinition(input.productKind),
    listTier2PartnerProfiles(),
    loadPublications(input.members),
    getDb().execute(sql<{
      resource_set_checksum: string;
      registry_revision_checksum: string;
    }>`
      select resource_set.content_checksum as resource_set_checksum,
        revision.content_checksum as registry_revision_checksum
      from private.reference_resource_sets as resource_set
      cross join private.ax_registry_revisions as revision
      where resource_set.id = ${input.resourceSetId}::uuid
        and revision.id = ${input.registryRevisionId}::uuid
      limit 1
    `) as unknown as Promise<Array<{
      resource_set_checksum: string;
      registry_revision_checksum: string;
    }>>,
    targetRowsPromise,
  ]);
  if (!bindingRows[0]) {
    throw new Tier2ProductError(
      "The selected reference set or AX registry revision no longer exists.",
      409,
      "release-binding-missing",
    );
  }
  if (!targetRows[0]) {
    throw new Tier2ProductError(
      "The stable Tier 2 publication target is unavailable.",
      409,
      "publication-target-missing",
    );
  }
  const expectedCurrentPublicationId = targetRows[0].current_publication_id;
  await assertTier2ReleaseRevisionCompatibility({
    selectedRevisionId: input.registryRevisionId,
    loaded,
  });
  const requiredProfileKeys = profiles
    .filter((profile) => profile.active)
    .map((profile) => profile.profileKey)
    .sort();
  if (input.productKind === "tier2" && requiredProfileKeys.length === 0) {
    throw new Tier2ProductError(
      "Tier 2 has no active required partner profiles.",
      409,
      "no-active-partner-profiles",
    );
  }
  const builtCandidate = buildCandidate({
    productKind: input.productKind,
    requiredProfileKeys,
    partnerKeys: new Map(profiles.map((profile) => [profile.profileKey, profile.partnerKey])),
    loaded,
  });
  const candidate: Tier2ProductCandidate = {
    ...builtCandidate,
    inputFingerprint: createTier2ProductInputFingerprint({
      candidateFingerprint: builtCandidate.inputFingerprint,
      resourceSetId: input.resourceSetId,
      resourceSetChecksum: bindingRows[0].resource_set_checksum,
      registryRevisionId: input.registryRevisionId,
      registryRevisionChecksum: bindingRows[0].registry_revision_checksum,
      databaseDefinitionChecksum: definition.checksum,
      codeDefinitionChecksum: getTier2ProductDefinitionContract(input.productKind).checksum,
      expectedCurrentPublicationId,
    }),
  };
  const existingRows = (await getDb().execute(sql<{ id: string }>`
    select id from private.pipeline_runs
    where definition_key = ${definition.definition_key}
      and input_fingerprint = ${candidate.inputFingerprint}
      and status not in ('rejected', 'failed')
    order by created_at desc
    limit 1
  `)) as unknown as { id: string }[];
  if (existingRows[0]) return getTier2ProductRun(existingRows[0].id);

  const runId = randomUUID();
  const releaseSetId = randomUUID();
  const orderedMembers = input.members.map((selection) => {
    const loadedMember = loaded.find((member) => member.selection.inputKey === selection.inputKey)!;
    return {
      inputKey: selection.inputKey,
      publicationId: selection.publicationId,
      outputChecksum: loadedMember.publication.output_checksum,
      rowCount: loadedMember.publication.row_count,
    };
  });
  const artifacts = await persistTier2ProductArtifacts({
    definitionKey: definition.definition_key,
    definitionVersion: definition.version,
    definitionChecksum: definition.checksum,
    runId,
    candidate,
    members: orderedMembers,
    findings: candidate.findings,
  });

  try {
    await getDb().transaction(async (tx) => {
      await tx.execute(sql`
        select pg_advisory_xact_lock(
          hashtextextended(${`tier2-release:${definition.definition_key}`}, 0)
        )
      `);
      for (const member of orderedMembers) {
        const current = (await tx.execute(sql<{ output_checksum: string; row_count: number }>`
          select output_checksum, row_count
          from private.pipeline_publications
          where id = ${member.publicationId}::uuid
          for share
        `)) as unknown as Array<{ output_checksum: string; row_count: number }>;
        if (
          !current[0] || current[0].output_checksum !== member.outputChecksum ||
          current[0].row_count !== member.rowCount
        ) {
          throw new Tier2ProductError(
            `The ${member.inputKey} publication changed while the review candidate was being retained.`,
            409,
            "publication-changed-during-candidate-creation",
          );
        }
      }
      await tx.execute(sql`
        insert into private.pipeline_release_sets (
          id, release_key, resource_set_id, registry_revision_id,
          rule_version, rule_checksum, rule_payload, created_by_owner_id,
          created_by_email
        ) values (
          ${releaseSetId}::uuid, ${definition.definition_key},
          ${input.resourceSetId}::uuid, ${input.registryRevisionId}::uuid,
          ${definition.version}, ${definition.checksum},
          ${JSON.stringify(orderedMembers.map((member) => member.inputKey))}::jsonb,
          ${input.actorOwnerId}, ${input.actorEmail}
        )
      `);
      for (const [position, member] of orderedMembers.entries()) {
        await tx.execute(sql`
          insert into private.pipeline_release_members (
            release_set_id, position, input_key, publication_id,
            publication_checksum, publication_row_count, registry_revision_id
          ) values (
            ${releaseSetId}::uuid, ${position}, ${member.inputKey},
            ${member.publicationId}::uuid, ${member.outputChecksum},
            ${member.rowCount}, ${input.registryRevisionId}::uuid
          )
        `);
      }
      await tx.execute(sql`
        insert into private.pipeline_runs (
          id, definition_key, definition_version, definition_checksum,
          release_set_id, resource_set_id, registry_revision_id,
          actor_owner_id, actor_email, status, input_fingerprint,
          expected_current_publication_id,
          input_row_count, output_row_count, warning_count, error_count,
          validation_summary, artifact_manifest, output_checksum,
          started_at, completed_at
        ) values (
          ${runId}::uuid, ${definition.definition_key}, ${definition.version},
          ${definition.checksum}, ${releaseSetId}::uuid,
          ${input.resourceSetId}::uuid, ${input.registryRevisionId}::uuid,
          ${input.actorOwnerId}, ${input.actorEmail},
          ${candidate.valid ? "valid" : "invalid"}, ${candidate.inputFingerprint},
          ${expectedCurrentPublicationId}::uuid,
          ${orderedMembers.reduce((sum, member) => sum + member.rowCount, 0)},
          ${candidate.rows.length},
          ${candidate.findings.filter((finding) => finding.severity === "warning").length},
          ${candidate.findings.filter((finding) => finding.severity === "error").length},
          ${JSON.stringify({
            valid: candidate.valid,
            findingCount: candidate.findings.length,
            productKind: candidate.kind,
            columns: artifacts.columns,
            artifactColumnsChecksum: checksumSourceFormingValue(artifacts.columns),
            artifactManifestChecksum: checksumSourceFormingValue(artifacts.manifest),
          })}::jsonb,
          ${JSON.stringify(artifacts.manifest)}::jsonb, ${candidate.outputChecksum},
          now(), now()
        )
      `);
      for (const [position, member] of orderedMembers.entries()) {
        await tx.execute(sql`
          insert into private.pipeline_run_inputs (
            run_id, position, input_key, publication_id,
            publication_checksum, publication_row_count
          ) values (
            ${runId}::uuid, ${position}, ${member.inputKey},
            ${member.publicationId}::uuid, ${member.outputChecksum},
            ${member.rowCount}
          )
        `);
      }
      for (const artifact of artifacts.manifest.artifacts) {
        await tx.execute(sql`
          insert into private.pipeline_artifacts (
            run_id, artifact_kind, storage_path, content_checksum,
            size_bytes, schema_version
          ) values (
            ${runId}::uuid, ${artifact.kind}, ${artifact.storagePath},
            ${artifact.checksum}, ${artifact.sizeBytes}, ${artifact.schemaVersion}
          )
        `);
      }
      for (const finding of candidate.findings) {
        await tx.execute(sql`
          insert into private.pipeline_findings (
            run_id, severity, rule_code, source_row_key, field_name,
            message, details
          ) values (
            ${runId}::uuid, ${finding.severity}, ${finding.ruleCode}, null,
            null, ${finding.message}, ${JSON.stringify({
              ...finding.details,
              memberPosition: finding.memberPosition,
              rowIndex: finding.rowIndex,
              canonicalPgic: finding.canonicalPgic,
            })}::jsonb
          )
        `);
      }
      for (const [rowIndex, row] of candidate.rows.entries()) {
        await tx.execute(sql`
          insert into private.tier2_pipeline_run_rows (run_id, row_index, data)
          values (${runId}::uuid, ${rowIndex}, ${JSON.stringify(row)}::jsonb)
        `);
      }
    });
  } catch (error) {
    await deletePipelineArtifacts(
      artifacts.manifest.artifacts.map((artifact) => artifact.storagePath),
    ).catch(() => undefined);
    throw error;
  }
  return getTier2ProductRun(runId);
}

export async function finalizeTier2ProductReleaseCandidate(input: {
  runId: string;
  actorOwnerId: string;
  actorEmail: string | null;
  reason: string;
}) {
  if (!input.reason.trim()) {
    throw new Tier2ProductError(
      "A release finalization reason is required.",
      400,
      "missing-reason",
    );
  }
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`
      select pg_advisory_xact_lock(
        hashtextextended(${`tier2-release-candidate:${input.runId}`}, 0)
      )
    `);
    const rows = (await tx.execute(sql<{
      run_id: string;
      run_status: string;
      error_count: number;
      release_set_id: string;
      release_status: "draft" | "finalized" | "cancelled";
      canonical_checksum: string | null;
    }>`
      select run.id as run_id, run.status as run_status, run.error_count,
        release_set.id as release_set_id, release_set.status as release_status,
        release_set.canonical_checksum
      from private.pipeline_runs as run
      join private.pipeline_release_sets as release_set
        on release_set.id = run.release_set_id
      where run.id = ${input.runId}::uuid
        and run.definition_key in (
          'tier2-complete-partners',
          'aggregate2-exact-union'
        )
      for update of run, release_set
    `)) as unknown as Array<{
      run_id: string;
      run_status: string;
      error_count: number;
      release_set_id: string;
      release_status: "draft" | "finalized" | "cancelled";
      canonical_checksum: string | null;
    }>;
    const candidate = rows[0];
    if (!candidate) {
      throw new Tier2ProductError(
        "Tier 2 release candidate not found.",
        404,
        "run-not-found",
      );
    }
    if (candidate.release_status === "finalized") {
      if (!candidate.canonical_checksum) {
        throw new Tier2ProductError(
          "The finalized Tier 2 release is missing its immutable checksum.",
          409,
          "finalized-release-checksum-missing",
        );
      }
      return {
        runId: candidate.run_id,
        releaseSetId: candidate.release_set_id,
        status: "finalized" as const,
        canonicalChecksum: candidate.canonical_checksum,
      };
    }
    if (candidate.release_status !== "draft") {
      throw new Tier2ProductError(
        "A rejected Tier 2 release candidate cannot be finalized.",
        409,
        "release-not-finalizable",
      );
    }
    if (candidate.run_status !== "valid" || candidate.error_count !== 0) {
      throw new Tier2ProductError(
        "Only a valid, error-free Tier 2 candidate can finalize its exact release.",
        409,
        "candidate-not-finalizable",
      );
    }
    const finalized = (await tx.execute(sql<{ canonical_checksum: string }>`
      select private.finalize_tier2_release_set(
        ${candidate.release_set_id}::uuid, ${input.actorOwnerId},
        ${input.actorEmail}, ${input.reason.trim()}
      ) as canonical_checksum
    `)) as unknown as Array<{ canonical_checksum: string }>;
    if (!finalized[0]?.canonical_checksum) {
      throw new Tier2ProductError(
        "The Tier 2 release candidate could not be finalized atomically.",
        409,
        "release-finalization-failed",
      );
    }
    return {
      runId: candidate.run_id,
      releaseSetId: candidate.release_set_id,
      status: "finalized" as const,
      canonicalChecksum: finalized[0].canonical_checksum,
    };
  });
}

export async function publishTier2ProductRun(input: {
  runId: string;
  acknowledgeWarnings: boolean;
  actorOwnerId: string;
  actorEmail: string | null;
  reason: string;
}) {
  const run = await getTier2ProductRun(input.runId);
  if (!run) throw new Tier2ProductError("Tier 2 product run not found.", 404, "run-not-found");
  if (run.status === "published") {
    if (!run.publicationId) {
      throw new Tier2ProductError(
        "The published Tier 2 product is missing its immutable publication.",
        409,
        "published-publication-missing",
      );
    }
    return {
      publicationId: run.publicationId,
      versionNumber: null,
      run,
    };
  }
  if (run.status !== "valid" || run.errorCount !== 0) {
    throw new Tier2ProductError(
      "Only a valid, error-free Tier 2 product candidate can publish.",
      409,
      "candidate-not-publishable",
    );
  }
  if (run.outOfDate) {
    throw new Tier2ProductError(
      `The candidate is out of date because ${run.changedInputs.join(", ")} advanced.`,
      409,
      "candidate-out-of-date",
      { changedInputs: run.changedInputs },
    );
  }
  const definitionContract = getTier2ProductDefinitionContract(run.productKind);
  const currentDefinition = (await getDb().execute(sql<{
    version: string;
    checksum: string;
    is_workspace_visible: boolean;
  }>`
    select version, checksum, is_workspace_visible from private.pipeline_definitions
    where definition_key = ${run.definitionKey} and active
    limit 1
  `)) as unknown as Array<{
    version: string;
    checksum: string;
    is_workspace_visible: boolean;
  }>;
  if (
    !currentDefinition[0] ||
    currentDefinition[0].version !== run.definitionVersion ||
    currentDefinition[0].checksum !== run.definitionChecksum ||
    currentDefinition[0].is_workspace_visible !==
      definitionContract.isWorkspaceVisible
  ) {
    throw new Tier2ProductError(
      "The Tier 2 product definition changed after candidate review.",
      409,
      "stale-definition",
    );
  }
  if (run.warningCount > 0 && !input.acknowledgeWarnings) {
    throw new Tier2ProductError(
      "Acknowledge candidate warnings before publication.",
      409,
      "warnings-not-acknowledged",
    );
  }
  if (!input.reason.trim()) {
    throw new Tier2ProductError("A publication reason is required.", 400, "missing-reason");
  }

  const expectedColumnsChecksum =
    typeof run.validationSummary.artifactColumnsChecksum === "string"
      ? run.validationSummary.artifactColumnsChecksum
      : "";
  const expectedManifestChecksum =
    typeof run.validationSummary.artifactManifestChecksum === "string"
      ? run.validationSummary.artifactManifestChecksum
      : "";
  const { manifest } = assertTier2ProductArtifactEnvelope({
    manifest: run.artifactManifest,
    immutableColumns: run.validationSummary.columns,
    expectedColumnsChecksum,
    expectedManifestChecksum,
  });
  const [artifactRecords, storedRows, artifactBodies] = await Promise.all([
    getDb().execute(sql<{
      artifact_kind: string;
      storage_path: string;
      content_checksum: string;
      size_bytes: number;
      schema_version: number;
    }>`
      select artifact_kind, storage_path, content_checksum, size_bytes, schema_version
      from private.pipeline_artifacts
      where run_id = ${input.runId}::uuid
      order by artifact_kind
    `) as unknown as Promise<Array<{
      artifact_kind: string;
      storage_path: string;
      content_checksum: string;
      size_bytes: number;
      schema_version: number;
    }>>,
    getDb().execute(sql<{ row_index: number; data: Record<string, string> }>`
      select row_index, data from private.tier2_pipeline_run_rows
      where run_id = ${input.runId}::uuid order by row_index
    `) as unknown as Promise<Array<{
      row_index: number;
      data: Record<string, string>;
    }>>,
    Promise.all(manifest.artifacts.map(async (artifact) => [
      artifact.kind,
      await readPipelineArtifact(artifact.storagePath),
    ] as const)),
  ]);
  const exactRows = storedRows.map((row) => row.data);
  const parsed = assertTier2ProductArtifactEvidence({
    manifest,
    artifactRecords: artifactRecords.map((artifact) => ({
      artifactKind: artifact.artifact_kind,
      storagePath: artifact.storage_path,
      contentChecksum: artifact.content_checksum,
      sizeBytes: artifact.size_bytes,
      schemaVersion: artifact.schema_version,
    })),
    artifactBodies: Object.fromEntries(artifactBodies),
    immutableColumns: run.validationSummary.columns,
    storedRows: exactRows,
    expectedRowCount: run.outputRowCount ?? -1,
    expectedOutputChecksum: run.outputChecksum ?? "",
    expectedColumnsChecksum,
    expectedManifestChecksum,
  });
  const targetRows = (await getDb().execute(sql<{
    current_publication_id: string | null;
    dataset_id: string | null;
  }>`
    select target.current_publication_id, publication.dataset_id
    from private.tier2_publication_targets as target
    left join private.pipeline_publications as publication
      on publication.id = target.current_publication_id
    where target.product_kind = ${run.productKind}
    limit 1
  `)) as unknown as Array<{
    current_publication_id: string | null;
    dataset_id: string | null;
  }>;
  if (!targetRows[0]) {
    throw new Tier2ProductError(
      "The stable publication target is unavailable.",
      409,
      "publication-target-missing",
    );
  }
  assertTier2ProductCandidateTargetCurrent({
    productKind: run.productKind,
    expectedCurrentPublicationId: run.expectedCurrentPublicationId,
    currentPublicationId: targetRows[0].current_publication_id,
  });
  await finalizeTier2ProductReleaseCandidate({
    runId: input.runId,
    actorOwnerId: input.actorOwnerId,
    actorEmail: input.actorEmail,
    reason: input.reason,
  });
  const csv = serializePipelineRowsCsv(parsed.rows, parsed.columns);
  const fileName = `${run.publicationTargetKey}.csv`;
  const blobPath = await uploadPipelineDatasetBlob({ fileName, csv });
  let blobCommitted = false;
  try {
    let published: { publicationId: string; versionNumber: number } | null = null;
    const result = await publishPreparedDataset({
      targetDatasetId: targetRows[0].dataset_id,
      actorOwnerId: input.actorOwnerId,
      actorEmail: input.actorEmail,
      fileName,
      blobPath,
      sizeBytes: Buffer.byteLength(csv, "utf8"),
      columns: parsed.columns,
      rows: parsed.rows,
      classification: "PGIC",
      isWorkspaceVisible: definitionContract.isWorkspaceVisible,
      finalize: async ({ executor, datasetId }) => {
        const rows = (await executor.execute(sql<{
          publication_id: string;
          version_number: number;
        }>`
          select * from private.publish_tier2_pipeline_run(
            ${input.runId}::uuid, ${datasetId}::uuid, ${input.actorOwnerId},
            ${input.actorEmail}, ${input.reason.trim()}
          )
        `)) as unknown as Array<{ publication_id: string; version_number: number }>;
        published = {
          publicationId: rows[0]!.publication_id,
          versionNumber: rows[0]!.version_number,
        };
      },
    });
    const committed = published as {
      publicationId: string;
      versionNumber: number;
    } | null;
    blobCommitted = Boolean(result && committed);
    if (!result || !committed) {
      throw new Tier2ProductError(
        "The stable dataset target no longer exists.",
        409,
        "missing-publication-target",
      );
    }
    return {
      publicationId: committed.publicationId,
      versionNumber: committed.versionNumber,
      run: await getTier2ProductRun(input.runId),
    };
  } catch (error) {
    if (!blobCommitted) {
      await deletePipelineDatasetBlob(blobPath).catch(() => undefined);
    }
    if (error instanceof Tier2ProductError) throw error;
    const message = error instanceof Error ? error.message : "Tier 2 publication failed.";
    throw new Tier2ProductError(message, 409, "publication-conflict");
  }
}

export async function rollbackTier2ProductTarget(input: {
  productKind: Tier2ProductKind;
  publicationId: string;
  expectedCurrentPublicationId: string;
  actorOwnerId: string;
  actorEmail: string | null;
  reason: string;
}) {
  if (!input.reason.trim()) {
    throw new Tier2ProductError("A rollback reason is required.", 400, "missing-reason");
  }
  const targets = (await getDb().execute(sql<{
    publication_target_key: string;
    current_publication_id: string | null;
    dataset_id: string | null;
    is_workspace_visible: boolean | null;
  }>`
    select target.publication_target_key, target.current_publication_id,
      current_publication.dataset_id, dataset.is_workspace_visible
    from private.tier2_publication_targets as target
    left join private.pipeline_publications as current_publication
      on current_publication.id = target.current_publication_id
    left join public.datasets as dataset
      on dataset.id = current_publication.dataset_id
    where target.product_kind = ${input.productKind}
    limit 1
  `)) as unknown as Array<{
    publication_target_key: string;
    current_publication_id: string | null;
    dataset_id: string | null;
    is_workspace_visible: boolean | null;
  }>;
  const target = targets[0];
  if (
    !target || target.current_publication_id !== input.expectedCurrentPublicationId ||
    !target.dataset_id || typeof target.is_workspace_visible !== "boolean"
  ) {
    throw new Tier2ProductError(
      "The stable target changed since rollback review.",
      409,
      "rollback-conflict",
    );
  }
  const publications = (await getDb().execute(sql<{
    output_checksum: string;
    row_count: number;
    validation_summary: Record<string, unknown>;
  }>`
    select publication.output_checksum, publication.row_count,
      run.validation_summary
    from private.pipeline_publications as publication
    join private.pipeline_runs as run
      on run.id = publication.producer_run_id
    where publication.id = ${input.publicationId}::uuid
      and publication.publication_target_key = ${target.publication_target_key}
      and publication.dataset_id = ${target.dataset_id}::uuid
    limit 1
  `)) as unknown as Array<{
    output_checksum: string;
    row_count: number;
    validation_summary: Record<string, unknown>;
  }>;
  const publication = publications[0];
  const columns = publication?.validation_summary.columns;
  if (!publication || !Array.isArray(columns)) {
    throw new Tier2ProductError(
      "The rollback publication does not have restorable immutable evidence.",
      409,
      "rollback-publication-evidence-missing",
    );
  }
  const archivedRows = (await getDb().execute(sql<{
    data: Record<string, string>;
  }>`
    select data
    from private.pipeline_publication_rows
    where publication_id = ${input.publicationId}::uuid
    order by row_index
  `)) as unknown as Array<{ data: Record<string, string> }>;
  const rows = archivedRows.map((row) => row.data);
  assertTier2RollbackSnapshot({
    columns: columns as CsvColumn[],
    rows,
    expectedRowCount: publication.row_count,
    expectedOutputChecksum: publication.output_checksum,
  });
  const csv = serializePipelineRowsCsv(rows, columns as CsvColumn[]);
  const fileName = `${target.publication_target_key}.csv`;
  const blobPath = await uploadPipelineDatasetBlob({ fileName, csv });
  let blobCommitted = false;
  try {
    let versionNumber: number | null = null;
    const result = await publishPreparedDataset({
      targetDatasetId: target.dataset_id,
      actorOwnerId: input.actorOwnerId,
      actorEmail: input.actorEmail,
      fileName,
      blobPath,
      sizeBytes: Buffer.byteLength(csv, "utf8"),
      columns: columns as CsvColumn[],
      rows,
      classification: "PGIC",
      isWorkspaceVisible: target.is_workspace_visible,
      finalize: async ({ executor, datasetId }) => {
        const rollbackRows = (await executor.execute(sql<{ version_number: number }>`
          select private.rollback_tier2_publication_target(
            ${input.productKind}, ${input.publicationId}::uuid,
            ${input.expectedCurrentPublicationId}::uuid, ${datasetId}::uuid,
            ${input.actorOwnerId}, ${input.actorEmail}, ${input.reason.trim()}
          ) as version_number
        `)) as unknown as { version_number: number }[];
        versionNumber = rollbackRows[0]?.version_number ?? null;
      },
    });
    blobCommitted = Boolean(result && versionNumber !== null);
    if (!result || versionNumber === null) {
      throw new Tier2ProductError(
        "The stable rollback dataset target is unavailable.",
        409,
        "rollback-target-missing",
      );
    }
    return {
      productKind: input.productKind,
      publicationId: input.publicationId,
      versionNumber,
      datasetId: target.dataset_id,
    };
  } catch (error) {
    if (!blobCommitted) {
      await deletePipelineDatasetBlob(blobPath).catch(() => undefined);
    }
    if (error instanceof Tier2ProductError) throw error;
    const message = error instanceof Error ? error.message : "Tier 2 rollback failed.";
    throw new Tier2ProductError(message, 409, "rollback-conflict");
  }
}

export async function rejectTier2ProductRun(input: {
  runId: string;
  reason: string;
  actorOwnerId: string;
  actorEmail?: string | null;
}) {
  if (!input.reason.trim()) {
    throw new Tier2ProductError("A rejection reason is required.", 400, "missing-reason");
  }
  const runId = await getDb().transaction(async (tx) => {
    await tx.execute(sql`
      select pg_advisory_xact_lock(
        hashtextextended(${`tier2-release-candidate:${input.runId}`}, 0)
      )
    `);
    const candidates = (await tx.execute(sql<{
      run_id: string;
      run_status: string;
      release_set_id: string;
      release_status: "draft" | "finalized" | "cancelled";
    }>`
      select run.id as run_id, run.status as run_status,
        release_set.id as release_set_id, release_set.status as release_status
      from private.pipeline_runs as run
      join private.pipeline_release_sets as release_set
        on release_set.id = run.release_set_id
      where run.id = ${input.runId}::uuid
        and run.definition_key in (
          'tier2-complete-partners',
          'aggregate2-exact-union'
        )
      for update of run, release_set
    `)) as unknown as Array<{
      run_id: string;
      run_status: string;
      release_set_id: string;
      release_status: "draft" | "finalized" | "cancelled";
    }>;
    const candidate = candidates[0];
    if (!candidate) {
      throw new Tier2ProductError(
        "Tier 2 release candidate not found.",
        404,
        "run-not-found",
      );
    }
    if (candidate.run_status === "rejected") return candidate.run_id;
    if (!["valid", "invalid"].includes(candidate.run_status)) {
      throw new Tier2ProductError(
        "Only a reviewable Tier 2 candidate can be rejected.",
        409,
        "run-not-reviewable",
      );
    }
    if (candidate.release_status === "draft") {
      const cancelled = (await tx.execute(sql<{ id: string }>`
        update private.pipeline_release_sets
        set status = 'cancelled',
          finalized_by_owner_id = ${input.actorOwnerId},
          finalized_by_email = ${input.actorEmail ?? null},
          finalization_reason = ${input.reason.trim()},
          finalized_at = now()
        where id = ${candidate.release_set_id}::uuid and status = 'draft'
        returning id
      `)) as unknown as Array<{ id: string }>;
      if (!cancelled[0]) {
        throw new Tier2ProductError(
          "The Tier 2 draft release could not be rejected atomically.",
          409,
          "release-rejection-failed",
        );
      }
    } else if (
      candidate.release_status !== "finalized" &&
      candidate.release_status !== "cancelled"
    ) {
      throw new Tier2ProductError(
        "The Tier 2 release is not reviewable.",
        409,
        "release-not-reviewable",
      );
    }
    const rejected = (await tx.execute(sql<{ id: string }>`
      update private.pipeline_runs
      set status = 'rejected', rejection_reason = ${input.reason.trim()},
        rejected_by_owner_id = ${input.actorOwnerId}, rejected_at = now()
      where id = ${candidate.run_id}::uuid and status in ('valid', 'invalid')
      returning id
    `)) as unknown as Array<{ id: string }>;
    if (!rejected[0]) {
      throw new Tier2ProductError(
        "The Tier 2 candidate could not be rejected atomically.",
        409,
        "run-rejection-failed",
      );
    }
    return rejected[0].id;
  });
  const rejected = await getTier2ProductRun(runId);
  if (!rejected) {
    throw new Tier2ProductError(
      "The rejected Tier 2 candidate could not be reloaded.",
      409,
      "rejected-run-missing",
    );
  }
  return rejected;
}

export async function downloadTier2ProductArtifact(
  runId: string,
  kind: "rows-json" | "rows-csv" | "findings-json" | "lineage-json",
) {
  const run = await getTier2ProductRun(runId);
  if (!run) throw new Tier2ProductError("Tier 2 product run not found.", 404, "run-not-found");
  const manifest = run.artifactManifest as {
    artifacts?: Array<{ kind?: string; storagePath?: string }>;
  };
  const path = manifest.artifacts?.find((artifact) => artifact.kind === kind)?.storagePath;
  if (!path) throw new Tier2ProductError(`The ${kind} artifact is missing.`, 409, "missing-artifact");
  return {
    body: await readPipelineArtifact(path),
    contentType: kind === "rows-csv"
      ? "text/csv; charset=utf-8"
      : "application/json; charset=utf-8",
    fileName: `${run.definitionKey}-${run.id}-${kind}.${kind === "rows-csv" ? "csv" : "json"}`,
  };
}

export function summarizeTier2Candidate(candidate: Tier2ProductCandidate) {
  const findings: readonly Tier2ReleaseFinding[] = candidate.findings;
  return {
    kind: candidate.kind,
    valid: candidate.valid,
    rowCount: candidate.rows.length,
    outputChecksum: candidate.outputChecksum,
    warningCount: findings.filter((finding) => finding.severity === "warning").length,
    errorCount: findings.filter((finding) => finding.severity === "error").length,
  };
}
