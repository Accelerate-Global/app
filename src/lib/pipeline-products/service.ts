import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { parseApiConnectionRowsArtifact } from "@/lib/api-connection-output";
import { publishPreparedDataset } from "@/lib/datasets";
import { createDatasetStoragePath } from "@/lib/dataset-storage";
import { checksumProductValue, type Tier1PriorityRule } from "@/lib/tier1-products";
import {
  assertArchiveRecordUsable,
  DataArchiveRehydrationRequiredError,
} from "@/lib/data-archive/archive-state";

import {
  getPipelineOutputColumns,
  persistPipelineArtifacts,
  serializePipelineRows,
  serializePipelineRowsCsv,
} from "./artifacts";
import { comparePipelineOutput } from "./comparison";
import { getPipelineDefinition, listPipelineDefinitions } from "./definitions";
import { PipelineProductError } from "./errors";
import {
  deletePipelineArtifacts,
  deletePipelineDatasetBlob,
  readPipelineArtifact,
  uploadPipelineDatasetBlob,
} from "./storage";
import type {
  PipelineArtifactKind,
  PipelineArtifactManifest,
  PipelinePublicationInput,
  PipelineRunDetail,
  PipelineRunStatus,
  PipelineRunSummary,
} from "./types";

type RunRow = {
  id: string;
  definition_key: string;
  definition_version: string;
  definition_checksum: string;
  release_set_id: string | null;
  parent_publication_id: string | null;
  resource_set_id: string;
  registry_revision_id: string;
  status: PipelineRunStatus;
  input_fingerprint: string;
  input_row_count: number;
  output_row_count: number | null;
  warning_count: number;
  error_count: number;
  validation_summary: Record<string, unknown>;
  artifact_manifest: PipelineArtifactManifest;
  output_checksum: string | null;
  dataset_id: string | null;
  publication_id: string | null;
  expected_current_publication_id: string | null;
  publication_attempt_id: string | null;
  publishing_started_at: Date | string | null;
  publication_blob_path: string | null;
  rejection_reason: string | null;
  publication_reason: string | null;
  created_at: Date | string;
  completed_at: Date | string | null;
  is_out_of_date: boolean;
};

type PublicationRow = {
  id: string;
  producer_kind: string;
  producer_run_id: string;
  dataset_id: string;
  source_profile_key: string | null;
  registry_revision_id: string | null;
  output_checksum: string;
  row_count: number;
  artifact_manifest: Record<string, unknown>;
  publication_target_key: string | null;
  producer_definition_key: string | null;
  release_set_id: string | null;
  created_at: Date | string;
};

type InputBindingRow = {
  position: number;
  input_key: string;
  publication_id: string;
  publication_checksum: string;
  publication_row_count: number;
  registry_revision_id?: string;
};

type ReleaseRow = {
  id: string;
  resource_set_id: string;
  registry_revision_id: string;
  rule_payload: unknown;
  status: string;
};

type FindingRow = {
  severity: "warning" | "error";
  rule_code: string;
  source_row_key: string | null;
  field_name: string | null;
  message: string;
  details: Record<string, unknown>;
};

export type PipelineArtifactEvidenceRecord = Readonly<{
  kind: PipelineArtifactKind;
  storagePath: string;
  checksum: string;
  sizeBytes: number;
  schemaVersion: number;
}>;

const REQUIRED_PIPELINE_ARTIFACT_KINDS = [
  "rows-json",
  "rows-csv",
  "findings-json",
  "lineage-json",
] as const satisfies readonly PipelineArtifactKind[];

const PIPELINE_ARTIFACT_KINDS = new Set<PipelineArtifactKind>([
  ...REQUIRED_PIPELINE_ARTIFACT_KINDS,
  "comparison-json",
]);

function iso(value: Date | string | null) {
  return value === null ? null : new Date(value).toISOString();
}

function mapRun(row: RunRow): PipelineRunSummary {
  const definition = getPipelineDefinition(row.definition_key);
  return {
    id: row.id,
    definitionKey: row.definition_key,
    definitionName: definition.displayName,
    definitionVersion: row.definition_version,
    definitionChecksum: row.definition_checksum,
    releaseSetId: row.release_set_id,
    parentPublicationId: row.parent_publication_id,
    status: row.status,
    inputRowCount: row.input_row_count,
    outputRowCount: row.output_row_count,
    warningCount: row.warning_count,
    errorCount: row.error_count,
    outputChecksum: row.output_checksum,
    publicationId: row.publication_id,
    expectedCurrentPublicationId: row.expected_current_publication_id,
    publicationTargetKey: definition.publicationTargetKey,
    isOutOfDate: row.is_out_of_date,
    createdAt: iso(row.created_at)!,
    completedAt: iso(row.completed_at),
  };
}

const RUN_SELECT = sql.raw(`
  run.*,
  exists (
    select 1
    from private.pipeline_run_inputs as binding
    join private.pipeline_publications as retained on retained.id = binding.publication_id
    join private.pipeline_publications as newer
      on coalesce(newer.publication_target_key, newer.source_profile_key, '') =
         coalesce(retained.publication_target_key, retained.source_profile_key, '')
     and newer.created_at > retained.created_at
     and newer.id <> retained.id
    where binding.run_id = run.id
  ) as is_out_of_date
`);

const PIPELINE_PUBLICATION_LEASE_MS = 15 * 60 * 1_000;
const PIPELINE_PUBLICATION_LOCK_NAMESPACE = 29;

export function pipelinePublicationLeaseCutoff(now = new Date()) {
  return new Date(now.getTime() - PIPELINE_PUBLICATION_LEASE_MS);
}

export function samePublicationId(left: string | null, right: string | null) {
  return left === right;
}

export function assertExpectedCurrentPublication(input: {
  expectedPublicationId: string | null;
  actualPublicationId: string | null;
}) {
  if (!samePublicationId(input.expectedPublicationId, input.actualPublicationId)) {
    throw new PipelineProductError(
      "The publication target changed after this candidate was selected. Refresh and review again.",
      409,
      "publication-target-changed",
    );
  }
}

export function getPipelineProductDatasetPublicationPolicy(
  definition: ReturnType<typeof getPipelineDefinition>,
) {
  return {
    classification: definition.outputClassification,
    isWorkspaceVisible: definition.isWorkspaceVisible,
  } as const;
}

export async function executeCommittedPipelinePublication<TCommit, THydrated>(input: {
  publish: () => Promise<TCommit>;
  hydrate: (committed: TCommit) => Promise<THydrated>;
  compensate: () => Promise<void>;
}) {
  let committed = false;
  try {
    const result = await input.publish();
    committed = true;
    return await input.hydrate(result);
  } catch (error) {
    if (!committed) await input.compensate();
    throw error;
  }
}

export function assertPipelineRunDefinitionCurrent(input: {
  runDefinitionVersion: string;
  runDefinitionChecksum: string;
  activeDefinitionVersion: string;
  activeDefinitionChecksum: string;
  isOutOfDate: boolean;
}) {
  if (
    input.isOutOfDate ||
    input.runDefinitionVersion !== input.activeDefinitionVersion ||
    input.runDefinitionChecksum !== input.activeDefinitionChecksum
  ) {
    throw new PipelineProductError(
      "The pipeline candidate is stale and must be rebuilt before publication.",
      409,
      "stale-definition",
    );
  }
}

export async function syncPipelineDefinitions() {
  for (const definition of listPipelineDefinitions()) {
    await getDb().execute(sql`
      insert into private.pipeline_definitions (
        definition_key, stage, display_name, version, checksum, required_input_keys,
        output_classification, publication_target_key, is_workspace_visible, active
      ) values (
        ${definition.key}, ${definition.stage}, ${definition.displayName}, ${definition.version},
        ${definition.checksum}, ${JSON.stringify(definition.requiredInputKeys)}::jsonb,
        ${definition.outputClassification}, ${definition.publicationTargetKey},
        ${definition.isWorkspaceVisible}, true
      )
      on conflict (definition_key) do update
      set stage = excluded.stage, display_name = excluded.display_name,
          version = excluded.version, checksum = excluded.checksum,
          required_input_keys = excluded.required_input_keys,
          output_classification = excluded.output_classification,
          publication_target_key = excluded.publication_target_key,
          is_workspace_visible = excluded.is_workspace_visible, active = true
    `);
  }
}

async function publicationRows(executor: Pick<ReturnType<typeof getDb>, "execute">, publicationId: string) {
  const rows = (await executor.execute(sql<{ row_index: number; data: Record<string, string> }>`
    select row_index, data
    from private.pipeline_publication_rows
    where publication_id = ${publicationId}::uuid
    order by row_index
  `)) as unknown as Array<{ row_index: number; data: Record<string, string> }>;
  return rows.map((row) => row.data);
}

async function loadReleaseInputs(releaseSetId: string) {
  const releaseRows = (await getDb().execute(sql<ReleaseRow>`
    select id, resource_set_id, registry_revision_id, rule_payload, status
    from private.pipeline_release_sets where id = ${releaseSetId}::uuid limit 1
  `)) as unknown as ReleaseRow[];
  const release = releaseRows[0];
  if (!release || release.status !== "finalized") {
    throw new PipelineProductError("A finalized Tier 1 release is required.", 409, "release-not-finalized");
  }
  const bindings = (await getDb().execute(sql<InputBindingRow>`
    select position, input_key, publication_id, publication_checksum, publication_row_count, registry_revision_id
    from private.pipeline_release_members
    where release_set_id = ${releaseSetId}::uuid
    order by position
  `)) as unknown as InputBindingRow[];
  const inputs: PipelinePublicationInput[] = [];
  for (const binding of bindings) {
    const rows = await publicationRows(getDb(), binding.publication_id);
    if (rows.length !== binding.publication_row_count) {
      throw new PipelineProductError("A pinned release publication archive is incomplete.", 409, "incomplete-release-input");
    }
    inputs.push({
      inputKey: binding.input_key,
      publicationId: binding.publication_id,
      outputChecksum: binding.publication_checksum,
      rowCount: binding.publication_row_count,
      registryRevisionId: binding.registry_revision_id ?? release.registry_revision_id,
      rows,
    });
  }
  return {
    release,
    inputs,
    priorities: (Array.isArray(release.rule_payload) ? release.rule_payload : []) as Tier1PriorityRule[],
  };
}

async function loadParentInput(parentPublicationId: string) {
  const publications = (await getDb().execute(sql<PublicationRow>`
    select * from private.pipeline_publications where id = ${parentPublicationId}::uuid limit 1
  `)) as unknown as PublicationRow[];
  const publication = publications[0];
  if (!publication) throw new PipelineProductError("The selected parent publication was not found.", 404, "missing-parent");
  if (!publication.release_set_id) {
    throw new PipelineProductError("The parent publication has no retained Tier 1 release lineage.", 409, "missing-release-lineage");
  }
  const releaseRows = (await getDb().execute(sql<ReleaseRow>`
    select id, resource_set_id, registry_revision_id, rule_payload, status
    from private.pipeline_release_sets where id = ${publication.release_set_id}::uuid limit 1
  `)) as unknown as ReleaseRow[];
  const release = releaseRows[0];
  if (!release || release.status !== "finalized") {
    throw new PipelineProductError("The parent publication release is unavailable.", 409, "missing-release-lineage");
  }
  const rows = await publicationRows(getDb(), publication.id);
  if (rows.length !== publication.row_count) {
    throw new PipelineProductError("The parent publication archive is incomplete.", 409, "incomplete-parent-archive");
  }
  return {
    release,
    publication,
    inputs: [{
      inputKey: publication.publication_target_key ?? "parent",
      publicationId: publication.id,
      outputChecksum: publication.output_checksum,
      rowCount: publication.row_count,
      registryRevisionId: publication.registry_revision_id ?? release.registry_revision_id,
      rows,
    }] satisfies PipelinePublicationInput[],
    priorities: (Array.isArray(release.rule_payload) ? release.rule_payload : []) as Tier1PriorityRule[],
  };
}

async function retainedOutputRows(publicationTargetKey: string) {
  const publications = (await getDb().execute(sql<PublicationRow>`
    select * from private.pipeline_publications
    where publication_target_key = ${publicationTargetKey}
    order by created_at desc, id desc
    limit 1
  `)) as unknown as PublicationRow[];
  return publications[0] ? publicationRows(getDb(), publications[0].id) : null;
}

function withoutPublicationRows(input: PipelinePublicationInput) {
  return {
    inputKey: input.inputKey,
    publicationId: input.publicationId,
    outputChecksum: input.outputChecksum,
    rowCount: input.rowCount,
    registryRevisionId: input.registryRevisionId,
  };
}

async function markBuildFailed(runId: string, message: string) {
  await getDb().execute(sql`
    update private.pipeline_runs
    set status = 'failed', error_message = ${message}, completed_at = now()
    where id = ${runId}::uuid and status = 'building'
  `);
}

export function resolvePipelineBuildExpectedCurrentPublication(input: {
  pinnedPublicationId: string | null | undefined;
  currentPublicationId: string | null;
}) {
  return input.pinnedPublicationId === undefined
    ? input.currentPublicationId
    : input.pinnedPublicationId;
}

export async function recoverStalePipelinePublications(input?: {
  runId?: string;
  now?: Date;
}) {
  const cutoff = pipelinePublicationLeaseCutoff(input?.now);
  const recovered = await getDb().transaction(async (tx) => (
    (await tx.execute(sql<{ id: string; publication_blob_path: string | null }>`
      with stale as (
        select id, publication_blob_path
        from private.pipeline_runs
        where status = 'publishing'
          and coalesce(publishing_started_at, created_at) < ${cutoff}
          and (${input?.runId ?? null}::uuid is null or id = ${input?.runId ?? null}::uuid)
        for update
      )
      update private.pipeline_runs as run
      set status = 'valid', publication_attempt_id = null,
          publishing_started_at = null, publication_blob_path = null,
          error_message = 'A stale publication attempt was recovered. Review and publish again.'
      from stale
      where run.id = stale.id
      returning run.id, stale.publication_blob_path
    `)) as unknown as Array<{ id: string; publication_blob_path: string | null }>
  ));

  await Promise.all(recovered.map(async (row) => {
    if (row.publication_blob_path) {
      await deletePipelineDatasetBlob(row.publication_blob_path).catch(() => undefined);
    }
  }));
  return recovered.length;
}

export async function buildPipelineProduct(input: {
  definitionKey: string;
  releaseSetId?: string | null;
  parentPublicationId?: string | null;
  expectedCurrentPublicationId?: string | null;
  actorOwnerId: string;
  actorEmail: string | null;
}) {
  await syncPipelineDefinitions();
  await recoverStalePipelinePublications();
  const definition = getPipelineDefinition(input.definitionKey);
  if (!input.actorOwnerId.trim()) throw new PipelineProductError("The build actor is required.", 400);
  if (definition.stage === "tier1-merge" && (!input.releaseSetId || input.parentPublicationId)) {
    throw new PipelineProductError("Tier 1 merge builds require exactly one finalized release.", 400, "invalid-build-input");
  }
  if (definition.stage === "aggregate1" && (!input.parentPublicationId || input.releaseSetId)) {
    throw new PipelineProductError("Aggregate 1 builds require exactly one parent publication.", 400, "invalid-build-input");
  }

  const bound = definition.stage === "tier1-merge"
    ? await loadReleaseInputs(input.releaseSetId!)
    : await loadParentInput(input.parentPublicationId!);
  const actualKeys = bound.inputs.map((candidate) => candidate.inputKey).sort();
  const requiredKeys = [...definition.requiredInputKeys].sort();
  if (actualKeys.length !== requiredKeys.length || actualKeys.some((key, index) => key !== requiredKeys[index])) {
    throw new PipelineProductError(
      `The selected input does not provide ${definition.requiredInputKeys.join(", ")}.`,
      409,
      "incompatible-build-input",
    );
  }
  let currentPublicationId: string | null = null;
  if (input.expectedCurrentPublicationId === undefined) {
    const currentTargetRows = (await getDb().execute(sql<{ id: string }>`
      select id
      from private.pipeline_publications
      where publication_target_key = ${definition.publicationTargetKey}
      order by created_at desc, id desc
      limit 1
    `)) as unknown as { id: string }[];
    currentPublicationId = currentTargetRows[0]?.id ?? null;
  }
  const expectedCurrentPublicationId =
    resolvePipelineBuildExpectedCurrentPublication({
      pinnedPublicationId: input.expectedCurrentPublicationId,
      currentPublicationId,
    });

  const inputFingerprint = checksumProductValue({
    definitionKey: definition.key,
    definitionVersion: definition.version,
    definitionChecksum: definition.checksum,
    releaseSetId: input.releaseSetId ?? null,
    parentPublicationId: input.parentPublicationId ?? null,
    resourceSetId: bound.release.resource_set_id,
    registryRevisionId: bound.release.registry_revision_id,
    inputs: bound.inputs.map((candidate) => ({
      inputKey: candidate.inputKey,
      publicationId: candidate.publicationId,
      checksum: candidate.outputChecksum,
      rowCount: candidate.rowCount,
    })),
    priorities: bound.priorities,
    expectedCurrentPublicationId,
  });

  const existing = (await getDb().execute(sql<RunRow>`
    select ${RUN_SELECT}
    from private.pipeline_runs as run
    where run.definition_key = ${definition.key} and run.input_fingerprint = ${inputFingerprint}
      and run.status in ('building', 'valid', 'publishing')
    order by run.created_at desc limit 1
  `)) as unknown as RunRow[];
  if (existing[0]) return mapRun(existing[0]);

  const created = await getDb().transaction(async (tx) => {
    const runs = (await tx.execute(sql<{ id: string }>`
      insert into private.pipeline_runs (
        definition_key, definition_version, definition_checksum, release_set_id,
        parent_publication_id, resource_set_id, registry_revision_id, actor_owner_id,
        actor_email, status, input_fingerprint, input_row_count,
        expected_current_publication_id, started_at
      ) values (
        ${definition.key}, ${definition.version}, ${definition.checksum}, ${input.releaseSetId ?? null}::uuid,
        ${input.parentPublicationId ?? null}::uuid, ${bound.release.resource_set_id}::uuid,
        ${bound.release.registry_revision_id}::uuid, ${input.actorOwnerId}, ${input.actorEmail},
        'building', ${inputFingerprint}, ${bound.inputs.reduce((total, candidate) => total + candidate.rowCount, 0)},
        ${expectedCurrentPublicationId}::uuid, now()
      ) returning id
    `)) as unknown as { id: string }[];
    const runId = runs[0].id;
    for (const [position, candidate] of bound.inputs.entries()) {
      await tx.execute(sql`
        insert into private.pipeline_run_inputs (
          run_id, position, input_key, publication_id, publication_checksum, publication_row_count
        ) values (
          ${runId}::uuid, ${position}, ${candidate.inputKey}, ${candidate.publicationId}::uuid,
          ${candidate.outputChecksum}, ${candidate.rowCount}
        )
      `);
    }
    return runId;
  });

  let storagePaths: string[] = [];
  try {
    const result = definition.build({ inputs: bound.inputs, priorities: bound.priorities });
    const retainedRows = await retainedOutputRows(definition.publicationTargetKey);
    const comparison = retainedRows
      ? comparePipelineOutput({ definitionKey: definition.key, currentRows: result.rows, retainedRows })
      : undefined;
    const persisted = await persistPipelineArtifacts({
      definition,
      runId: created,
      inputs: bound.inputs.map(withoutPublicationRows),
      rows: result.rows,
      findings: result.findings,
      comparison,
    });
    storagePaths = persisted.manifest.artifacts.map((artifact) => artifact.storagePath);
    const outputChecksum = checksumProductValue(result.rows);
    const nextStatus: PipelineRunStatus = result.errorCount > 0 ? "invalid" : "valid";
    await getDb().transaction(async (tx) => {
      for (const artifact of persisted.manifest.artifacts) {
        await tx.execute(sql`
          insert into private.pipeline_artifacts (
            run_id, artifact_kind, storage_path, content_checksum, size_bytes, schema_version
          ) values (
            ${created}::uuid, ${artifact.kind}, ${artifact.storagePath}, ${artifact.checksum},
            ${artifact.sizeBytes}, ${artifact.schemaVersion}
          )
        `);
      }
      for (const finding of result.findings) {
        await tx.execute(sql`
          insert into private.pipeline_findings (
            run_id, severity, rule_code, source_row_key, field_name, message, details
          ) values (
            ${created}::uuid, ${finding.severity}, ${finding.ruleCode}, ${finding.sourceRowKey},
            ${finding.fieldName}, ${finding.message}, ${JSON.stringify(finding.details)}::jsonb
          )
        `);
      }
      await tx.execute(sql`
        update private.pipeline_runs
        set status = ${nextStatus}, output_row_count = ${result.outputRowCount},
            warning_count = ${result.warningCount}, error_count = ${result.errorCount},
            validation_summary = ${JSON.stringify({
              warnings: result.warningCount,
              errors: result.errorCount,
              findingRuleCodes: [...new Set(result.findings.map((finding) => finding.ruleCode))].sort(),
            })}::jsonb,
            artifact_manifest = ${JSON.stringify(persisted.manifest)}::jsonb,
            output_checksum = ${outputChecksum}, completed_at = now()
        where id = ${created}::uuid and status = 'building'
      `);
    });
    return await getPipelineRun(created);
  } catch (error) {
    if (storagePaths.length > 0) await deletePipelineArtifacts(storagePaths).catch(() => undefined);
    await markBuildFailed(created, error instanceof Error ? error.message : "Pipeline build failed.");
    throw error;
  }
}

export async function listPipelineRuns(limit = 100) {
  const rows = (await getDb().execute(sql<RunRow>`
    select ${RUN_SELECT}
    from private.pipeline_runs as run
    order by run.created_at desc, run.id desc
    limit ${Math.max(1, Math.min(250, limit))}
  `)) as unknown as RunRow[];
  return rows.map(mapRun);
}

export async function listPipelineProductPublications(limit = 250) {
  const rows = (await getDb().execute(sql<PublicationRow>`
    select * from private.pipeline_publications
    where publication_target_key is not null
    order by created_at desc, id desc
    limit ${Math.max(1, Math.min(500, limit))}
  `)) as unknown as PublicationRow[];
  return rows.map((row) => ({
    id: row.id,
    producerKind: row.producer_kind,
    producerDefinitionKey: row.producer_definition_key,
    publicationTargetKey: row.publication_target_key,
    datasetId: row.dataset_id,
    releaseSetId: row.release_set_id,
    registryRevisionId: row.registry_revision_id,
    outputChecksum: row.output_checksum,
    rowCount: row.row_count,
    createdAt: iso(row.created_at)!,
  }));
}

export async function getPipelineRun(runId: string): Promise<PipelineRunDetail | null> {
  const rows = (await getDb().execute(sql<RunRow>`
    select ${RUN_SELECT}
    from private.pipeline_runs as run
    where run.id = ${runId}::uuid limit 1
  `)) as unknown as RunRow[];
  const row = rows[0];
  if (!row) return null;
  const inputs = (await getDb().execute(sql<InputBindingRow>`
    select position, input_key, publication_id, publication_checksum, publication_row_count
    from private.pipeline_run_inputs where run_id = ${runId}::uuid order by position
  `)) as unknown as InputBindingRow[];
  const findings = (await getDb().execute(sql<FindingRow>`
    select severity, rule_code, source_row_key, field_name, message, details
    from private.pipeline_findings where run_id = ${runId}::uuid order by id
  `)) as unknown as FindingRow[];
  const summary = mapRun(row);
  return {
    ...summary,
    validationSummary: row.validation_summary ?? {},
    artifactManifest: row.artifact_manifest?.schemaVersion ? row.artifact_manifest : { schemaVersion: 1, artifacts: [] },
    findings: findings.map((finding) => ({
      severity: finding.severity,
      ruleCode: finding.rule_code,
      sourceRowKey: finding.source_row_key,
      fieldName: finding.field_name,
      message: finding.message,
      details: finding.details ?? {},
    })),
    inputs: inputs.map((binding) => ({
      inputKey: binding.input_key,
      publicationId: binding.publication_id,
      outputChecksum: binding.publication_checksum,
      rowCount: binding.publication_row_count,
      registryRevisionId: row.registry_revision_id,
    })),
    rejectionReason: row.rejection_reason,
    publicationReason: row.publication_reason,
    datasetId: row.dataset_id,
  };
}

export async function rejectPipelineRun(input: {
  runId: string;
  reason: string;
  actorOwnerId: string;
}) {
  if (!input.reason.trim()) throw new PipelineProductError("A rejection reason is required.", 400, "missing-reason");
  const rows = (await getDb().execute(sql<{ id: string }>`
    update private.pipeline_runs
    set status = 'rejected', rejection_reason = ${input.reason.trim()},
        rejected_by_owner_id = ${input.actorOwnerId}, rejected_at = now()
    where id = ${input.runId}::uuid and status in ('valid', 'invalid')
    returning id
  `)) as unknown as { id: string }[];
  if (!rows[0]) throw new PipelineProductError("Only a reviewable pipeline candidate can be rejected.", 409, "run-not-reviewable");
  return getPipelineRun(rows[0].id);
}

function artifactPath(manifest: PipelineArtifactManifest, kind: PipelineArtifactKind) {
  const artifact = manifest.artifacts.find((candidate) => candidate.kind === kind);
  if (!artifact) throw new PipelineProductError(`The ${kind} artifact is missing.`, 409, "missing-artifact");
  return artifact.storagePath;
}

function artifactEvidenceMismatch(message: string): never {
  throw new PipelineProductError(message, 409, "artifact-checksum-mismatch");
}

export function validatePipelineArtifactManifestEvidence(input: {
  manifest: PipelineArtifactManifest;
  records: readonly PipelineArtifactEvidenceRecord[];
}) {
  if (input.manifest.schemaVersion !== 1 || !Array.isArray(input.manifest.artifacts)) {
    artifactEvidenceMismatch("The candidate artifact manifest is invalid.");
  }
  const manifestByKind = new Map<PipelineArtifactKind, PipelineArtifactManifest["artifacts"][number]>();
  for (const artifact of input.manifest.artifacts) {
    if (!PIPELINE_ARTIFACT_KINDS.has(artifact.kind) || manifestByKind.has(artifact.kind)) {
      artifactEvidenceMismatch("The candidate artifact manifest has an invalid or duplicate kind.");
    }
    manifestByKind.set(artifact.kind, artifact);
  }
  const recordsByKind = new Map<PipelineArtifactKind, PipelineArtifactEvidenceRecord>();
  for (const record of input.records) {
    if (!PIPELINE_ARTIFACT_KINDS.has(record.kind) || recordsByKind.has(record.kind)) {
      artifactEvidenceMismatch("The immutable artifact records have an invalid or duplicate kind.");
    }
    recordsByKind.set(record.kind, record);
  }
  if (
    manifestByKind.size !== recordsByKind.size
    || REQUIRED_PIPELINE_ARTIFACT_KINDS.some((kind) => !manifestByKind.has(kind))
  ) {
    artifactEvidenceMismatch(
      "The candidate artifact manifest does not match its immutable artifact records.",
    );
  }
  for (const [kind, artifact] of manifestByKind) {
    const record = recordsByKind.get(kind);
    if (
      !record
      || artifact.storagePath !== record.storagePath
      || artifact.checksum !== record.checksum
      || artifact.sizeBytes !== record.sizeBytes
      || artifact.schemaVersion !== record.schemaVersion
      || artifact.schemaVersion !== 1
    ) {
      artifactEvidenceMismatch(
        "The candidate artifact manifest does not match its immutable artifact records.",
      );
    }
  }
  return recordsByKind;
}

export function validatePipelineOutputArtifact(input: {
  body: string;
  expectedRowCount: number;
  expectedChecksum: string;
}) {
  const parsed = parseApiConnectionRowsArtifact(input.body);
  if (
    parsed.rows.length !== input.expectedRowCount
    || checksumProductValue(parsed.rows) !== input.expectedChecksum
  ) {
    throw new PipelineProductError(
      "The candidate row artifact no longer matches its reviewed checksum.",
      409,
      "artifact-checksum-mismatch",
    );
  }
  return parsed;
}

export function validatePipelineRollbackSnapshot(input: {
  rowsBody: string;
  csvBody: string;
  publicationRows: readonly Record<string, string>[];
  expectedRowCount: number;
  expectedOutputChecksum: string;
}) {
  const parsed = validatePipelineOutputArtifact({
    body: input.rowsBody,
    expectedRowCount: input.expectedRowCount,
    expectedChecksum: input.expectedOutputChecksum,
  });
  const columns = getPipelineOutputColumns(parsed.rows);
  if (
    serializePipelineRows(parsed.rows, columns) !== input.rowsBody
    || serializePipelineRowsCsv(parsed.rows, columns) !== input.csvBody
  ) {
    throw new PipelineProductError(
      "The retained rollback publication no longer matches its immutable row artifacts.",
      409,
      "rollback-publication-evidence-mismatch",
    );
  }
  if (
    input.publicationRows.length !== input.expectedRowCount
    || checksumProductValue(input.publicationRows) !== input.expectedOutputChecksum
    || serializePipelineRows(input.publicationRows, columns) !== input.rowsBody
  ) {
    throw new PipelineProductError(
      "The retained rollback publication rows no longer match its reviewed evidence.",
      409,
      "rollback-publication-evidence-mismatch",
    );
  }
  return { rows: [...input.publicationRows], columns };
}

export function validatePipelinePublicationArtifacts(input: {
  manifest: PipelineArtifactManifest;
  records: readonly PipelineArtifactEvidenceRecord[];
  bodies: ReadonlyMap<PipelineArtifactKind, string>;
  expectedRowCount: number;
  expectedOutputChecksum: string;
  definition: ReturnType<typeof getPipelineDefinition>;
  inputs: PipelineRunDetail["inputs"];
  findings: PipelineRunDetail["findings"];
}) {
  const recordsByKind = validatePipelineArtifactManifestEvidence({
    manifest: input.manifest,
    records: input.records,
  });
  for (const [kind, record] of recordsByKind) {
    const body = input.bodies.get(kind);
    if (
      body === undefined
      || checksumProductValue(body) !== record.checksum
      || Buffer.byteLength(body, "utf8") !== record.sizeBytes
    ) {
      artifactEvidenceMismatch(
        `The ${kind} artifact no longer matches its immutable checksum and size.`,
      );
    }
  }

  const rowsBody = input.bodies.get("rows-json")!;
  let parsed: ReturnType<typeof parseApiConnectionRowsArtifact>;
  try {
    parsed = validatePipelineOutputArtifact({
      body: rowsBody,
      expectedRowCount: input.expectedRowCount,
      expectedChecksum: input.expectedOutputChecksum,
    });
  } catch (error) {
    if (error instanceof PipelineProductError) throw error;
    artifactEvidenceMismatch("The candidate row artifact is not valid JSON.");
  }
  const expectedColumns = getPipelineOutputColumns(parsed.rows);
  if (serializePipelineRows(parsed.rows, expectedColumns) !== rowsBody) {
    artifactEvidenceMismatch(
      "The candidate row artifact columns no longer match its reviewed rows.",
    );
  }
  if (
    input.bodies.get("rows-csv")
    !== serializePipelineRowsCsv(parsed.rows, expectedColumns)
  ) {
    artifactEvidenceMismatch("The candidate CSV artifact no longer matches its reviewed rows and columns.");
  }

  const expectedFindings = {
    schemaVersion: 1,
    findings: input.findings,
  };
  const expectedLineage = {
    schemaVersion: 1,
    definitionKey: input.definition.key,
    definitionVersion: input.definition.version,
    definitionChecksum: input.definition.checksum,
    definitionIsWorkspaceVisible: input.definition.isWorkspaceVisible,
    definitionSemanticContract: input.definition.semanticContract,
    inputs: input.inputs,
  };
  for (const [kind, expected] of [
    ["findings-json", expectedFindings],
    ["lineage-json", expectedLineage],
  ] as const) {
    let actual: unknown;
    try {
      actual = JSON.parse(input.bodies.get(kind)!);
    } catch {
      artifactEvidenceMismatch(`The ${kind} artifact is not valid JSON.`);
    }
    if (checksumProductValue(actual) !== checksumProductValue(expected)) {
      artifactEvidenceMismatch(`The ${kind} artifact no longer matches its reviewed evidence.`);
    }
  }
  return { rows: parsed.rows, columns: expectedColumns };
}

export async function downloadPipelineRunArtifact(runId: string, kind: PipelineArtifactKind) {
  const run = await getPipelineRun(runId);
  if (!run) throw new PipelineProductError("Pipeline run not found.", 404, "run-not-found");
  const path = artifactPath(run.artifactManifest, kind);
  return {
    body: await readPipelineArtifact(path),
    contentType: kind === "rows-csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
    fileName: `${run.definitionKey}-${run.id}-${kind}.${kind === "rows-csv" ? "csv" : "json"}`,
  };
}

export async function publishPipelineRun(input: {
  runId: string;
  reason: string;
  acknowledgeWarnings: boolean;
  expectedCurrentPublicationId: string | null;
  actorOwnerId: string;
  actorEmail: string | null;
}) {
  if (!input.reason.trim()) throw new PipelineProductError("A publication reason is required.", 400, "missing-reason");
  await recoverStalePipelinePublications({ runId: input.runId });
  const run = await getPipelineRun(input.runId);
  if (!run) throw new PipelineProductError("Pipeline run not found.", 404, "run-not-found");
  if (run.status === "published" && run.publicationId) {
    return run;
  }
  if (run.status !== "valid") throw new PipelineProductError("Only a valid candidate can be published.", 409, "run-not-valid");
  assertExpectedCurrentPublication({
    expectedPublicationId: run.expectedCurrentPublicationId,
    actualPublicationId: input.expectedCurrentPublicationId,
  });
  if (run.warningCount > 0 && !input.acknowledgeWarnings) {
    throw new PipelineProductError("Acknowledge candidate warnings before publication.", 409, "warnings-not-acknowledged");
  }
  const definition = getPipelineDefinition(run.definitionKey);
  const artifactRows = (await getDb().execute(sql<{
    artifact_kind: PipelineArtifactKind;
    storage_path: string;
    content_checksum: string;
    size_bytes: number;
    schema_version: number;
  }>`
    select artifact_kind, storage_path, content_checksum, size_bytes, schema_version
    from private.pipeline_artifacts
    where run_id = ${run.id}::uuid
    order by created_at, id
  `)) as unknown as Array<{
    artifact_kind: PipelineArtifactKind;
    storage_path: string;
    content_checksum: string;
    size_bytes: number;
    schema_version: number;
  }>;
  const artifactRecords = artifactRows.map((artifact) => ({
    kind: artifact.artifact_kind,
    storagePath: artifact.storage_path,
    checksum: artifact.content_checksum,
    sizeBytes: artifact.size_bytes,
    schemaVersion: artifact.schema_version,
  }));
  validatePipelineArtifactManifestEvidence({
    manifest: run.artifactManifest,
    records: artifactRecords,
  });
  const artifactBodies = new Map<PipelineArtifactKind, string>(await Promise.all(
    artifactRecords.map(async (artifact) => [
      artifact.kind,
      await readPipelineArtifact(artifact.storagePath),
    ] as const),
  ));
  const parsed = validatePipelinePublicationArtifacts({
    manifest: run.artifactManifest,
    records: artifactRecords,
    bodies: artifactBodies,
    expectedRowCount: run.outputRowCount ?? -1,
    expectedOutputChecksum: run.outputChecksum ?? "",
    definition,
    inputs: run.inputs,
    findings: run.findings,
  });
  const definitionRows = (await getDb().execute(sql<{ checksum: string; version: string }>`
    select checksum, version from private.pipeline_definitions where definition_key = ${definition.key} limit 1
  `)) as unknown as Array<{ checksum: string; version: string }>;
  if (!definitionRows[0]) {
    throw new PipelineProductError(
      "The pipeline definition is unavailable.",
      409,
      "stale-definition",
    );
  }
  assertPipelineRunDefinitionCurrent({
    runDefinitionVersion: run.definitionVersion,
    runDefinitionChecksum: run.definitionChecksum,
    activeDefinitionVersion: definitionRows[0].version,
    activeDefinitionChecksum: definitionRows[0].checksum,
    isOutOfDate: run.isOutOfDate,
  });
  if (
    definitionRows[0].checksum !== definition.checksum ||
    definitionRows[0].version !== definition.version
  ) {
    throw new PipelineProductError(
      "The deployed pipeline definition does not match the active catalog.",
      409,
      "stale-definition",
    );
  }
  const retained = (await getDb().execute(sql<PublicationRow>`
    select * from private.pipeline_publications
    where publication_target_key = ${definition.publicationTargetKey}
    order by created_at desc, id desc limit 1
  `)) as unknown as PublicationRow[];
  assertExpectedCurrentPublication({
    expectedPublicationId: run.expectedCurrentPublicationId,
    actualPublicationId: retained[0]?.id ?? null,
  });
  let publicationReleaseSetId = run.releaseSetId;
  if (!publicationReleaseSetId && run.parentPublicationId) {
    const parentRows = (await getDb().execute(sql<{ release_set_id: string | null }>`
      select release_set_id from private.pipeline_publications
      where id = ${run.parentPublicationId}::uuid limit 1
    `)) as unknown as Array<{ release_set_id: string | null }>;
    publicationReleaseSetId = parentRows[0]?.release_set_id ?? null;
  }
  if (!publicationReleaseSetId) {
    throw new PipelineProductError("The candidate has no retained release lineage.", 409, "missing-release-lineage");
  }
  const csv = serializePipelineRowsCsv(parsed.rows, parsed.columns);
  const fileName = `${definition.publicationTargetKey}.csv`;
  const datasetPolicy = getPipelineProductDatasetPublicationPolicy(definition);
  const attemptId = randomUUID();
  const blobPath = createDatasetStoragePath(fileName);
  const claimed = (await getDb().execute(sql<{ id: string }>`
    update private.pipeline_runs
    set status = 'publishing', warnings_acknowledged = ${input.acknowledgeWarnings},
      publishing_started_at = now(), publication_blob_path = ${blobPath},
      publication_attempt_id = ${attemptId}::uuid,
      error_message = null
    where id = ${input.runId}::uuid and status = 'valid'
      and definition_version = ${definition.version}
      and definition_checksum = ${definition.checksum}
      and not exists (
        select 1
        from private.pipeline_run_inputs as binding
        join private.pipeline_publications as retained_input on retained_input.id = binding.publication_id
        join private.pipeline_publications as newer
          on coalesce(newer.publication_target_key, newer.source_profile_key, '') =
             coalesce(retained_input.publication_target_key, retained_input.source_profile_key, '')
         and newer.created_at > retained_input.created_at
         and newer.id <> retained_input.id
        where binding.run_id = private.pipeline_runs.id
      )
    returning id
  `)) as unknown as { id: string }[];
  if (!claimed[0]) {
    throw new PipelineProductError("The candidate is already being published or is no longer valid.", 409, "publication-race");
  }

  return executeCommittedPipelinePublication({
    publish: async () => {
    await uploadPipelineDatasetBlob({ fileName, csv, storagePath: blobPath });
    const result = await publishPreparedDataset({
      targetDatasetId: retained[0]?.dataset_id ?? null,
      actorOwnerId: input.actorOwnerId,
      actorEmail: input.actorEmail,
      fileName,
      blobPath,
      sizeBytes: Buffer.byteLength(csv, "utf8"),
      columns: parsed.columns,
      rows: parsed.rows,
      classification: datasetPolicy.classification,
      isWorkspaceVisible: datasetPolicy.isWorkspaceVisible,
      finalize: async ({ executor, datasetId }) => {
        await executor.execute(sql`
          select pg_advisory_xact_lock(
            hashtextextended(
              ${`pipeline-publication:${definition.publicationTargetKey}`},
              ${PIPELINE_PUBLICATION_LOCK_NAMESPACE}
            )
          )
        `);
        const ownedRuns = (await executor.execute(sql<RunRow>`
          select ${RUN_SELECT}
          from private.pipeline_runs as run
          where run.id = ${input.runId}::uuid
            and run.status = 'publishing'
            and run.publication_attempt_id = ${attemptId}::uuid
          for update
        `)) as unknown as RunRow[];
        const ownedRun = ownedRuns[0];
        if (!ownedRun) {
          throw new PipelineProductError(
            "This publication attempt no longer owns the candidate lease.",
            409,
            "publication-lease-lost",
          );
        }
        assertExpectedCurrentPublication({
          expectedPublicationId: ownedRun.expected_current_publication_id,
          actualPublicationId: input.expectedCurrentPublicationId,
        });
        const currentDefinitions = (await executor.execute(sql<{ checksum: string; version: string }>`
          select checksum, version
          from private.pipeline_definitions
          where definition_key = ${definition.key}
          limit 1
          for update
        `)) as unknown as Array<{ checksum: string; version: string }>;
        if (!currentDefinitions[0]) {
          throw new PipelineProductError("The pipeline definition is unavailable.", 409, "stale-definition");
        }
        assertPipelineRunDefinitionCurrent({
          runDefinitionVersion: ownedRun.definition_version,
          runDefinitionChecksum: ownedRun.definition_checksum,
          activeDefinitionVersion: currentDefinitions[0].version,
          activeDefinitionChecksum: currentDefinitions[0].checksum,
          isOutOfDate: ownedRun.is_out_of_date,
        });
        if (
          currentDefinitions[0].version !== definition.version
          || currentDefinitions[0].checksum !== definition.checksum
        ) {
          throw new PipelineProductError(
            "The deployed pipeline definition does not match the active catalog.",
            409,
            "stale-definition",
          );
        }
        const currentTargets = (await executor.execute(sql<{ id: string }>`
          select id from private.pipeline_publications
          where publication_target_key = ${definition.publicationTargetKey}
          order by created_at desc, id desc limit 1
        `)) as unknown as { id: string }[];
        assertExpectedCurrentPublication({
          expectedPublicationId: ownedRun.expected_current_publication_id,
          actualPublicationId: currentTargets[0]?.id ?? null,
        });
        const publications = (await executor.execute(sql<{ id: string }>`
          insert into private.pipeline_publications (
            producer_kind, producer_run_id, dataset_id, source_profile_key,
            registry_revision_id, output_checksum, row_count, artifact_manifest,
            actor_owner_id, actor_email, reason, publication_target_key,
            producer_definition_key, release_set_id
          ) values (
            ${definition.stage === "tier1-merge" ? "tier1-merge" : "aggregate1"}, ${input.runId}::uuid,
            ${datasetId}::uuid, null, ${run.inputs[0]?.registryRevisionId ?? null}::uuid,
            ${run.outputChecksum}, ${parsed.rows.length}, ${JSON.stringify(run.artifactManifest)}::jsonb,
            ${input.actorOwnerId}, ${input.actorEmail}, ${input.reason.trim()},
            ${definition.publicationTargetKey}, ${definition.key}, ${publicationReleaseSetId}::uuid
          ) returning id
        `)) as unknown as { id: string }[];
        const publicationId = publications[0].id;
        const batchSize = 2_000;
        for (let offset = 0; offset < parsed.rows.length; offset += batchSize) {
          const batch = parsed.rows.slice(offset, offset + batchSize);
          await executor.execute(sql`
            insert into private.pipeline_publication_rows (publication_id, row_index, data)
            select ${publicationId}::uuid, (${offset} + ordinal - 1)::integer, value
            from jsonb_array_elements(${JSON.stringify(batch)}::jsonb) with ordinality as entry(value, ordinal)
          `);
        }
        for (const [position, binding] of run.inputs.entries()) {
          await executor.execute(sql`
            insert into private.pipeline_publication_inputs (
              publication_id, position, input_key, input_publication_id, input_checksum
            ) values (
              ${publicationId}::uuid, ${position}, ${binding.inputKey}, ${binding.publicationId}::uuid,
              ${binding.outputChecksum}
            )
          `);
        }
        const committedRuns = (await executor.execute(sql<{ id: string }>`
          update private.pipeline_runs
          set status = 'published', dataset_id = ${datasetId}::uuid, publication_id = ${publicationId}::uuid,
              publication_reason = ${input.reason.trim()}, published_by_owner_id = ${input.actorOwnerId},
              published_at = now(), publishing_started_at = null,
              publication_blob_path = ${blobPath}, publication_attempt_id = null
          where id = ${input.runId}::uuid and status = 'publishing'
            and publication_attempt_id = ${attemptId}::uuid
          returning id
        `)) as unknown as { id: string }[];
        if (!committedRuns[0]) {
          throw new PipelineProductError(
            "This publication attempt lost its lease before commit.",
            409,
            "publication-lease-lost",
          );
        }
      },
    });
      if (!result) throw new PipelineProductError("The retained publication target no longer exists.", 409, "missing-publication-target");
      return result;
    },
    hydrate: async () => getPipelineRun(input.runId),
    compensate: async () => {
      await deletePipelineDatasetBlob(blobPath).catch(() => undefined);
      await getDb().execute(sql`
        update private.pipeline_runs
        set status = 'valid', error_message = 'Publication failed; the candidate remains reviewable.',
          publishing_started_at = null, publication_blob_path = null,
          publication_attempt_id = null
        where id = ${input.runId}::uuid and status = 'publishing'
          and publication_attempt_id = ${attemptId}::uuid
      `);
    },
  });
}

export async function rollbackPipelineProductTarget(input: {
  publicationTargetKey: string;
  publicationId: string;
  expectedCurrentPublicationId: string;
  actorOwnerId: string;
  actorEmail: string | null;
  reason: string;
}) {
  if (!input.actorOwnerId.trim()) {
    throw new PipelineProductError("The rollback actor is required.", 400, "missing-actor");
  }
  if (!input.reason.trim()) {
    throw new PipelineProductError("A rollback reason is required.", 400, "missing-reason");
  }
  const definition = listPipelineDefinitions().find(
    (candidate) => candidate.publicationTargetKey === input.publicationTargetKey,
  );
  if (!definition) {
    throw new PipelineProductError(
      "Pipeline publication target not found.",
      404,
      "publication-target-not-found",
    );
  }

  const currentTargets = (await getDb().execute(sql<{
    current_publication_id: string;
    dataset_id: string;
    is_workspace_visible: boolean;
    dataset_status: string;
  }>`
    select publication.id as current_publication_id, publication.dataset_id,
      dataset.is_workspace_visible, dataset.status as dataset_status
    from private.pipeline_publications as publication
    join public.datasets as dataset on dataset.id = publication.dataset_id
    where publication.publication_target_key = ${definition.publicationTargetKey}
    order by publication.created_at desc, publication.id desc
    limit 1
  `)) as unknown as Array<{
    current_publication_id: string;
    dataset_id: string;
    is_workspace_visible: boolean;
    dataset_status: string;
  }>;
  const currentTarget = currentTargets[0];
  if (
    !currentTarget
    || currentTarget.current_publication_id !== input.expectedCurrentPublicationId
    || currentTarget.dataset_status !== "ready"
  ) {
    throw new PipelineProductError(
      "The stable target changed since rollback review.",
      409,
      "rollback-conflict",
    );
  }

  const retainedPublications = (await getDb().execute(sql<PublicationRow & {
    definition_key: string;
    archive_status: "verified" | "cold" | "rehydrating" | "rehydrated" | "failed" | null;
    archive_rehydration_verified: boolean;
  }>`
    select publication.*, run.definition_key,
      archive_package.status as archive_status,
      coalesce(exists (
        select 1 from private.data_archive_rehydrations as rehydration
        where rehydration.package_id = archive_package.id
          and rehydration.status = 'verified'
          and rehydration.manifest_checksum = archive_package.manifest_checksum
      ), false) as archive_rehydration_verified
    from private.pipeline_publications as publication
    join private.pipeline_runs as run on run.id = publication.producer_run_id
    left join lateral (
      select package.id, package.status, package.manifest_checksum
      from private.data_archive_packages as package
      where package.package_kind = 'tier1-publication'
        and package.source_identifier = publication.id::text
      order by package.source_created_at desc, package.created_at desc
      limit 1
    ) as archive_package on true
    where publication.id = ${input.publicationId}::uuid
      and publication.publication_target_key = ${definition.publicationTargetKey}
      and publication.dataset_id = ${currentTarget.dataset_id}::uuid
      and publication.producer_definition_key = ${definition.key}
      and run.definition_key = ${definition.key}
    limit 1
  `)) as unknown as Array<PublicationRow & {
    definition_key: string;
    archive_status: "verified" | "cold" | "rehydrating" | "rehydrated" | "failed" | null;
    archive_rehydration_verified: boolean;
  }>;
  const retainedPublication = retainedPublications[0];
  if (!retainedPublication) {
    throw new PipelineProductError(
      "The retained publication does not belong to this stable target.",
      409,
      "rollback-publication-incompatible",
    );
  }
  try {
    assertArchiveRecordUsable({
      status: retainedPublication.archive_status ?? null,
      verifiedRehydration: Boolean(retainedPublication.archive_rehydration_verified),
    });
  } catch (error) {
    if (error instanceof DataArchiveRehydrationRequiredError) {
      throw new PipelineProductError(error.message, error.status, error.code);
    }
    throw error;
  }
  const retainedRun = await getPipelineRun(retainedPublication.producer_run_id);
  if (
    !retainedRun
    || retainedRun.status !== "published"
    || retainedRun.publicationId !== retainedPublication.id
    || retainedRun.outputChecksum !== retainedPublication.output_checksum
    || retainedRun.outputRowCount !== retainedPublication.row_count
    || checksumProductValue(retainedRun.artifactManifest)
      !== checksumProductValue(retainedPublication.artifact_manifest)
  ) {
    throw new PipelineProductError(
      "The rollback publication does not have complete immutable run evidence.",
      409,
      "rollback-publication-evidence-missing",
    );
  }

  const artifactRows = (await getDb().execute(sql<{
    artifact_kind: PipelineArtifactKind;
    storage_path: string;
    content_checksum: string;
    size_bytes: number;
    schema_version: number;
  }>`
    select artifact_kind, storage_path, content_checksum, size_bytes, schema_version
    from private.pipeline_artifacts
    where run_id = ${retainedRun.id}::uuid
    order by created_at, id
  `)) as unknown as Array<{
    artifact_kind: PipelineArtifactKind;
    storage_path: string;
    content_checksum: string;
    size_bytes: number;
    schema_version: number;
  }>;
  const artifactRecords = artifactRows.map((artifact) => ({
    kind: artifact.artifact_kind,
    storagePath: artifact.storage_path,
    checksum: artifact.content_checksum,
    sizeBytes: artifact.size_bytes,
    schemaVersion: artifact.schema_version,
  }));
  const recordsByKind = validatePipelineArtifactManifestEvidence({
    manifest: retainedRun.artifactManifest,
    records: artifactRecords,
  });
  const artifactBodies = new Map<PipelineArtifactKind, string>(await Promise.all(
    artifactRecords.map(async (artifact) => [
      artifact.kind,
      await readPipelineArtifact(artifact.storagePath),
    ] as const),
  ));
  for (const [kind, record] of recordsByKind) {
    const body = artifactBodies.get(kind);
    if (
      body === undefined
      || checksumProductValue(body) !== record.checksum
      || Buffer.byteLength(body, "utf8") !== record.sizeBytes
    ) {
      artifactEvidenceMismatch(
        `The retained ${kind} artifact no longer matches its immutable checksum and size.`,
      );
    }
  }
  const archivedRows = await publicationRows(getDb(), retainedPublication.id);
  const snapshot = validatePipelineRollbackSnapshot({
    rowsBody: artifactBodies.get("rows-json")!,
    csvBody: artifactBodies.get("rows-csv")!,
    publicationRows: archivedRows,
    expectedRowCount: retainedPublication.row_count,
    expectedOutputChecksum: retainedPublication.output_checksum,
  });

  const csv = serializePipelineRowsCsv(snapshot.rows, snapshot.columns);
  const fileName = `${definition.publicationTargetKey}.csv`;
  const blobPath = await uploadPipelineDatasetBlob({ fileName, csv });
  const rollbackRunId = randomUUID();
  const rollbackPublicationId = randomUUID();
  const rollbackInputFingerprint = checksumProductValue({
    operation: "pipeline-publication-rollback",
    rollbackRunId,
    publicationTargetKey: definition.publicationTargetKey,
    retainedPublicationId: retainedPublication.id,
    expectedCurrentPublicationId: input.expectedCurrentPublicationId,
  });
  let committed = false;
  try {
    const result = await publishPreparedDataset({
      targetDatasetId: currentTarget.dataset_id,
      actorOwnerId: input.actorOwnerId,
      actorEmail: input.actorEmail,
      fileName,
      blobPath,
      sizeBytes: Buffer.byteLength(csv, "utf8"),
      columns: snapshot.columns,
      rows: snapshot.rows,
      classification: definition.outputClassification,
      isWorkspaceVisible: currentTarget.is_workspace_visible,
      finalize: async ({ executor, datasetId }) => {
        await executor.execute(sql`
          select pg_advisory_xact_lock(
            hashtextextended(
              ${`pipeline-publication:${definition.publicationTargetKey}`},
              ${PIPELINE_PUBLICATION_LOCK_NAMESPACE}
            )
          )
        `);
        const currentRows = (await executor.execute(sql<{ id: string }>`
          select id
          from private.pipeline_publications
          where publication_target_key = ${definition.publicationTargetKey}
          order by created_at desc, id desc
          limit 1
        `)) as unknown as Array<{ id: string }>;
        assertExpectedCurrentPublication({
          expectedPublicationId: input.expectedCurrentPublicationId,
          actualPublicationId: currentRows[0]?.id ?? null,
        });
        const retainedRows = (await executor.execute(sql<{ id: string }>`
          select id
          from private.pipeline_publications
          where id = ${retainedPublication.id}::uuid
            and publication_target_key = ${definition.publicationTargetKey}
            and dataset_id = ${datasetId}::uuid
            and producer_definition_key = ${definition.key}
          limit 1
        `)) as unknown as Array<{ id: string }>;
        if (!retainedRows[0]) {
          throw new PipelineProductError(
            "The retained rollback publication changed before commit.",
            409,
            "rollback-publication-incompatible",
          );
        }

        await executor.execute(sql`
          insert into private.pipeline_publications (
            id, producer_kind, producer_run_id, dataset_id, source_profile_key,
            registry_revision_id, output_checksum, row_count, artifact_manifest,
            actor_owner_id, actor_email, reason, publication_target_key,
            producer_definition_key, release_set_id
          ) values (
            ${rollbackPublicationId}::uuid, ${retainedPublication.producer_kind},
            ${rollbackRunId}::uuid, ${datasetId}::uuid, null,
            ${retainedPublication.registry_revision_id}::uuid,
            ${retainedPublication.output_checksum}, ${retainedPublication.row_count},
            ${JSON.stringify(retainedRun.artifactManifest)}::jsonb,
            ${input.actorOwnerId}, ${input.actorEmail}, ${input.reason.trim()},
            ${definition.publicationTargetKey}, ${definition.key},
            ${retainedPublication.release_set_id}::uuid
          )
        `);
        await executor.execute(sql`
          insert into private.pipeline_runs (
            id, definition_key, definition_version, definition_checksum,
            release_set_id, parent_publication_id, resource_set_id,
            registry_revision_id, actor_owner_id, actor_email, status,
            input_fingerprint, input_row_count, output_row_count, warning_count,
            error_count, validation_summary, artifact_manifest, output_checksum,
            dataset_id, publication_id, expected_current_publication_id,
            publication_reason, warnings_acknowledged, published_by_owner_id,
            published_at, publication_blob_path, started_at, completed_at
          )
          select
            ${rollbackRunId}::uuid, source.definition_key,
            source.definition_version, source.definition_checksum,
            source.release_set_id, source.parent_publication_id,
            source.resource_set_id, source.registry_revision_id,
            ${input.actorOwnerId}, ${input.actorEmail}, 'published',
            ${rollbackInputFingerprint}, source.input_row_count,
            source.output_row_count, source.warning_count, source.error_count,
            source.validation_summary || jsonb_build_object(
              'rollback',
              jsonb_build_object(
                'restoredFromPublicationId', ${retainedPublication.id},
                'replacedPublicationId', ${input.expectedCurrentPublicationId},
                'actorOwnerId', ${input.actorOwnerId},
                'actorEmail', ${input.actorEmail},
                'reason', ${input.reason.trim()}
              )
            ),
            source.artifact_manifest,
            source.output_checksum, ${datasetId}::uuid,
            ${rollbackPublicationId}::uuid,
            ${input.expectedCurrentPublicationId}::uuid,
            ${input.reason.trim()}, source.warnings_acknowledged,
            ${input.actorOwnerId}, now(), ${blobPath}, now(), now()
          from private.pipeline_runs as source
          where source.id = ${retainedRun.id}::uuid
        `);
        await executor.execute(sql`
          insert into private.pipeline_run_inputs (
            run_id, position, input_key, publication_id,
            publication_checksum, publication_row_count
          )
          select ${rollbackRunId}::uuid, position, input_key, publication_id,
            publication_checksum, publication_row_count
          from private.pipeline_run_inputs
          where run_id = ${retainedRun.id}::uuid
          order by position
        `);
        await executor.execute(sql`
          insert into private.pipeline_artifacts (
            run_id, artifact_kind, storage_path, content_checksum,
            size_bytes, schema_version
          )
          select ${rollbackRunId}::uuid, artifact_kind, storage_path,
            content_checksum, size_bytes, schema_version
          from private.pipeline_artifacts
          where run_id = ${retainedRun.id}::uuid
          order by created_at, id
        `);
        await executor.execute(sql`
          insert into private.pipeline_findings (
            run_id, severity, rule_code, source_row_key,
            field_name, message, details
          )
          select ${rollbackRunId}::uuid, severity, rule_code, source_row_key,
            field_name, message, details
          from private.pipeline_findings
          where run_id = ${retainedRun.id}::uuid
          order by id
        `);
        await executor.execute(sql`
          insert into private.pipeline_publication_rows (
            publication_id, row_index, data
          )
          select ${rollbackPublicationId}::uuid, row_index, data
          from private.pipeline_publication_rows
          where publication_id = ${retainedPublication.id}::uuid
          order by row_index
        `);
        await executor.execute(sql`
          insert into private.pipeline_publication_inputs (
            publication_id, position, input_key,
            input_publication_id, input_checksum
          )
          select ${rollbackPublicationId}::uuid, position, input_key,
            input_publication_id, input_checksum
          from private.pipeline_publication_inputs
          where publication_id = ${retainedPublication.id}::uuid
          order by position
        `);
      },
    });
    committed = Boolean(result);
    if (!result) {
      throw new PipelineProductError(
        "The stable rollback dataset target is unavailable.",
        409,
        "rollback-target-missing",
      );
    }
    return {
      definitionKey: definition.key,
      publicationTargetKey: definition.publicationTargetKey,
      restoredFromPublicationId: retainedPublication.id,
      publicationId: rollbackPublicationId,
      runId: rollbackRunId,
      datasetId: currentTarget.dataset_id,
    };
  } catch (error) {
    if (!committed) {
      await deletePipelineDatasetBlob(blobPath).catch(() => undefined);
    }
    if (error instanceof PipelineProductError) throw error;
    const message = error instanceof Error ? error.message : "Pipeline rollback failed.";
    throw new PipelineProductError(message, 409, "rollback-conflict");
  }
}

export async function getPipelineProductSystemState() {
  const resourceRows = (await getDb().execute(sql<{ id: string; content_checksum: string }>`
    select id, content_checksum from private.reference_resource_sets
    order by sequence_number desc limit 1
  `)) as unknown as Array<{ id: string; content_checksum: string }>;
  const revisionRows = (await getDb().execute(sql<{ id: string; revision_number: number; content_checksum: string }>`
    select id, revision_number, content_checksum from private.ax_registry_revisions
    order by revision_number desc limit 1
  `)) as unknown as Array<{ id: string; revision_number: number; content_checksum: string }>;
  return {
    resourceSet: resourceRows[0]
      ? { id: resourceRows[0].id, checksum: resourceRows[0].content_checksum }
      : null,
    registryRevision: revisionRows[0]
      ? { id: revisionRows[0].id, revisionNumber: Number(revisionRows[0].revision_number), checksum: revisionRows[0].content_checksum }
      : null,
    defaultRuleBinding: {
      version: "tier1-priority-fallback-v1",
      checksum: checksumProductValue([]),
      priorities: [] as Tier1PriorityRule[],
    },
  };
}
