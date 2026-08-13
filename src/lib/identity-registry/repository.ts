import { sql } from "drizzle-orm";

import { getDb } from "@/db";

import type {
  AxIdentityAuthorityStatus,
  AxIdentityCandidateRow,
  AxIdentityChangeDecision,
  AxIdentityFinding,
  AxIdentityRegistryEntry,
  AxIdentityRunDetail,
  AxIdentityRunStatus,
  AxIdentityRunSummary,
  AxRegistryRevision,
  PipelinePublication,
} from "./types";

type PublicationRow = {
  id: string;
  producer_kind: string;
  producer_run_id: string;
  dataset_id: string;
  source_profile_key: string | null;
  publication_target_key: string | null;
  registry_revision_id: string | null;
  output_checksum: string;
  row_count: number;
  artifact_manifest: Record<string, string>;
  created_at: Date | string;
};

type RunRow = {
  id: string;
  attempt_number: number;
  source_publication_id: string;
  base_revision_id: string | null;
  source_profile_key: string;
  rules_version: string;
  rules_checksum: string;
  resource_bindings: Record<string, string>;
  input_fingerprint: string;
  publication_target_key: string;
  expected_current_publication_id: string | null;
  status: AxIdentityRunStatus;
  input_row_count: number;
  output_row_count: number | null;
  reused_count: number;
  reserved_count: number;
  conflict_count: number;
  unassignable_count: number;
  warning_count: number;
  error_count: number;
  output_checksum: string | null;
  artifact_manifest: Record<string, string>;
  dataset_id: string | null;
  publication_id: string | null;
  is_current_publication: boolean;
  registry_revision_id: string | null;
  rejection_reason: string | null;
  publication_reason: string | null;
  reservation_expires_at: Date | string | null;
  created_at: Date | string;
  completed_at: Date | string | null;
};

function iso(value: Date | string | null) {
  return value === null ? null : new Date(value).toISOString();
}

function mapPublication(row: PublicationRow): PipelinePublication {
  return {
    id: row.id,
    producerKind: row.producer_kind,
    producerRunId: row.producer_run_id,
    datasetId: row.dataset_id,
    sourceProfileKey: row.source_profile_key,
    publicationTargetKey: row.publication_target_key,
    registryRevisionId: row.registry_revision_id,
    outputChecksum: row.output_checksum,
    rowCount: row.row_count,
    artifactManifest: row.artifact_manifest ?? {},
    createdAt: iso(row.created_at)!,
  };
}

function mapRun(row: RunRow): AxIdentityRunSummary {
  return {
    id: row.id,
    attemptNumber: row.attempt_number,
    sourcePublicationId: row.source_publication_id,
    baseRevisionId: row.base_revision_id,
    sourceProfileKey: row.source_profile_key,
    rulesVersion: row.rules_version,
    rulesChecksum: row.rules_checksum,
    resourceBindings: row.resource_bindings ?? {},
    inputFingerprint: row.input_fingerprint,
    publicationTargetKey: row.publication_target_key,
    expectedCurrentPublicationId: row.expected_current_publication_id,
    status: row.status,
    inputRowCount: row.input_row_count,
    outputRowCount: row.output_row_count,
    reusedCount: row.reused_count,
    reservedCount: row.reserved_count,
    conflictCount: row.conflict_count,
    unassignableCount: row.unassignable_count,
    warningCount: row.warning_count,
    errorCount: row.error_count,
    outputChecksum: row.output_checksum,
    artifactManifest: row.artifact_manifest ?? {},
    datasetId: row.dataset_id,
    publicationId: row.publication_id,
    isCurrentPublication: row.is_current_publication,
    registryRevisionId: row.registry_revision_id,
    rejectionReason: row.rejection_reason,
    publicationReason: row.publication_reason,
    reservationExpiresAt: iso(row.reservation_expires_at),
    createdAt: iso(row.created_at)!,
    completedAt: iso(row.completed_at),
  };
}

export async function getPipelinePublication(publicationId: string) {
  const rows = (await getDb().execute(sql<PublicationRow>`
    select * from private.pipeline_publications where id = ${publicationId}::uuid limit 1
  `)) as unknown as PublicationRow[];
  return rows[0] ? mapPublication(rows[0]) : null;
}

export async function getCurrentIdentityPublication(publicationTargetKey: string) {
  const rows = (await getDb().execute(sql<PublicationRow>`
    select *
    from private.pipeline_publications
    where producer_kind = 'identity'
      and publication_target_key = ${publicationTargetKey}
    order by created_at desc, id desc
    limit 1
  `)) as unknown as PublicationRow[];
  return rows[0] ? mapPublication(rows[0]) : null;
}

export async function listPipelinePublications(input: {
  producerKind?: string;
  sourceProfileKey?: string;
  limit?: number;
} = {}) {
  const limit = Math.max(1, Math.min(200, input.limit ?? 50));
  const rows = (await getDb().execute(sql<PublicationRow>`
    select *
    from private.pipeline_publications
    where (${input.producerKind ?? null}::text is null or producer_kind = ${input.producerKind ?? null})
      and (${input.sourceProfileKey ?? null}::text is null or source_profile_key = ${input.sourceProfileKey ?? null})
    order by created_at desc, id desc
    limit ${limit}
  `)) as unknown as PublicationRow[];
  return rows.map(mapPublication);
}

export async function getPipelinePublicationRows(publicationId: string) {
  return (await getDb().execute(sql<{ row_index: number; data: Record<string, string> }>`
    select row_index, data
    from private.pipeline_publication_rows
    where publication_id = ${publicationId}::uuid
    order by row_index
  `)) as unknown as { row_index: number; data: Record<string, string> }[];
}

export async function listAxIdentityRuns(limit = 50) {
  const rows = (await getDb().execute(sql<RunRow>`
    select run.*,
      coalesce(run.publication_id = (
        select publication.id
        from private.pipeline_publications as publication
        where publication.producer_kind = 'identity'
          and publication.publication_target_key = run.publication_target_key
        order by publication.created_at desc, publication.id desc
        limit 1
      ), false) as is_current_publication
    from private.ax_identity_runs as run
    order by run.created_at desc, run.id desc
    limit ${Math.max(1, Math.min(200, limit))}
  `)) as unknown as RunRow[];
  return rows.map(mapRun);
}

export async function getAxIdentityRun(runId: string): Promise<AxIdentityRunDetail | null> {
  const runs = (await getDb().execute(sql<RunRow>`
    select run.*,
      coalesce(run.publication_id = (
        select publication.id
        from private.pipeline_publications as publication
        where publication.producer_kind = 'identity'
          and publication.publication_target_key = run.publication_target_key
        order by publication.created_at desc, publication.id desc
        limit 1
      ), false) as is_current_publication
    from private.ax_identity_runs as run
    where run.id = ${runId}::uuid
    limit 1
  `)) as unknown as RunRow[];
  if (!runs[0]) return null;

  const findings = (await getDb().execute(sql<{
    severity: "warning" | "error";
    rule_code: string;
    source_row_index: number | null;
    stable_row_key: string | null;
    message: string;
    details: Record<string, unknown>;
  }>`
    select severity, rule_code, source_row_index, stable_row_key, message, details
    from private.ax_identity_findings
    where identity_run_id = ${runId}::uuid
    order by id
  `)) as unknown as Array<{
    severity: "warning" | "error";
    rule_code: string;
    source_row_index: number | null;
    stable_row_key: string | null;
    message: string;
    details: Record<string, unknown>;
  }>;
  const candidateRows = (await getDb().execute(sql<{
    source_row_index: number;
    stable_row_key: string | null;
    assignment_status: AxIdentityCandidateRow["assignmentStatus"];
    binding_id: string | null;
    pgac_code: string | null;
    pgic_code: string | null;
    enriched_row: Record<string, string>;
  }>`
    select source_row_index, stable_row_key, assignment_status, binding_id,
      pgac_code, pgic_code, enriched_row
    from private.ax_identity_run_rows
    where identity_run_id = ${runId}::uuid
    order by source_row_index
  `)) as unknown as Array<{
    source_row_index: number;
    stable_row_key: string | null;
    assignment_status: AxIdentityCandidateRow["assignmentStatus"];
    binding_id: string | null;
    pgac_code: string | null;
    pgic_code: string | null;
    enriched_row: Record<string, string>;
  }>;
  const decisions = (await getDb().execute(sql<{
    id: string;
    identity_run_id: string;
    source_row_index: number;
    source_profile_key: string;
    stable_row_key: string;
    current_binding_id: string;
    current_evidence: Record<string, unknown>;
    proposed_evidence: Record<string, unknown>;
    allowed_actions: AxIdentityChangeDecision["allowedActions"];
    selected_action: AxIdentityChangeDecision["selectedAction"];
    selected_at: Date | string | null;
  }>`
    select id, identity_run_id, source_row_index, source_profile_key,
      stable_row_key, current_binding_id, current_evidence, proposed_evidence,
      allowed_actions, selected_action, selected_at
    from private.ax_identity_change_decisions
    where identity_run_id = ${runId}::uuid
    order by source_row_index, id
  `)) as unknown as Array<{
    id: string;
    identity_run_id: string;
    source_row_index: number;
    source_profile_key: string;
    stable_row_key: string;
    current_binding_id: string;
    current_evidence: Record<string, unknown>;
    proposed_evidence: Record<string, unknown>;
    allowed_actions: AxIdentityChangeDecision["allowedActions"];
    selected_action: AxIdentityChangeDecision["selectedAction"];
    selected_at: Date | string | null;
  }>;

  return {
    ...mapRun(runs[0]),
    findings: findings.map(
      (entry): AxIdentityFinding => ({
        severity: entry.severity,
        ruleCode: entry.rule_code,
        sourceRowIndex: entry.source_row_index,
        stableRowKey: entry.stable_row_key,
        message: entry.message,
        details: entry.details ?? {},
      }),
    ),
    rows: candidateRows.map((entry) => ({
      sourceRowIndex: entry.source_row_index,
      stableRowKey: entry.stable_row_key,
      assignmentStatus: entry.assignment_status,
      bindingId: entry.binding_id,
      pgacCode: entry.pgac_code,
      pgicCode: entry.pgic_code,
      enrichedRow: entry.enriched_row,
    })),
    decisions: decisions.map((entry) => ({
      id: entry.id,
      identityRunId: entry.identity_run_id,
      sourceRowIndex: entry.source_row_index,
      sourceProfileKey: entry.source_profile_key,
      stableRowKey: entry.stable_row_key,
      currentBindingId: entry.current_binding_id,
      currentEvidence: entry.current_evidence ?? {},
      proposedEvidence: entry.proposed_evidence ?? {},
      allowedActions: entry.allowed_actions ?? [],
      selectedAction: entry.selected_action,
      selectedAt: iso(entry.selected_at),
    })),
  };
}

export async function listActiveIdentityBindings(revisionId?: string | null) {
  const rows = (await getDb().execute(sql<{
    binding_id: string;
    source_profile_key: string;
    stable_row_key: string;
    binding_state: AxIdentityRegistryEntry["bindingState"];
    identity_id: string;
    pgac_code: string;
    pgic_code: string | null;
    allocated_value: number | null;
    normalized_iso3: string | null;
    identity_evidence: Record<string, unknown>;
    activated_revision_id: string | null;
    created_at: Date | string;
  }>`
    select
      binding.id as binding_id, binding.source_profile_key, binding.stable_row_key,
      binding.binding_state, assigned.id as identity_id, parent_code.code as pgac_code,
      child_code.code as pgic_code, parent.allocated_value, assigned.normalized_iso3,
      binding.identity_evidence, binding.activated_revision_id, binding.created_at
    from private.ax_identity_source_bindings as binding
    join private.ax_identities as assigned on assigned.id = binding.identity_id
    join private.ax_identities as parent
      on parent.id = case when assigned.identity_kind = 'pgic'
        then assigned.parent_identity_id else assigned.id end
    join private.ax_identity_codes as parent_code
      on parent_code.identity_id = parent.id and parent_code.code_kind = 'canonical'
    left join private.ax_identity_codes as child_code
      on child_code.identity_id = assigned.id and assigned.identity_kind = 'pgic'
      and child_code.code_kind = 'canonical'
    where (
      ${revisionId ?? null}::uuid is null and binding.binding_state = 'active'
      or ${revisionId ?? null}::uuid is not null and exists (
        select 1 from private.ax_registry_revision_bindings as snapshot
        where snapshot.revision_id = ${revisionId ?? null}::uuid
          and snapshot.binding_id = binding.id
      )
    )
    order by binding.source_profile_key, binding.stable_row_key, binding.id
  `)) as unknown as Array<{
    binding_id: string;
    source_profile_key: string;
    stable_row_key: string;
    binding_state: AxIdentityRegistryEntry["bindingState"];
    identity_id: string;
    pgac_code: string;
    pgic_code: string | null;
    allocated_value: number | null;
    normalized_iso3: string | null;
    identity_evidence: Record<string, unknown>;
    activated_revision_id: string | null;
    created_at: Date | string;
  }>;
  return rows.map(
    (row): AxIdentityRegistryEntry => ({
      bindingId: row.binding_id,
      sourceProfileKey: row.source_profile_key,
      stableRowKey: row.stable_row_key,
      bindingState: row.binding_state,
      identityId: row.identity_id,
      pgacCode: row.pgac_code,
      pgicCode: row.pgic_code,
      allocatedValue: row.allocated_value,
      normalizedIso3: row.normalized_iso3,
      identityEvidence: row.identity_evidence ?? {},
      activatedRevisionId: row.activated_revision_id,
      createdAt: iso(row.created_at)!,
    }),
  );
}

export async function getIdentityRegistryRevision(revisionId: string) {
  const rows = (await getDb().execute(sql<{
    id: string;
    revision_number: number;
    previous_revision_id: string | null;
    content_checksum: string;
    binding_count: number;
    actor_owner_id: string;
    actor_email: string | null;
    reason: string;
    created_at: Date | string;
  }>`
    select * from private.ax_registry_revisions where id = ${revisionId}::uuid limit 1
  `)) as unknown as Array<{
    id: string;
    revision_number: number;
    previous_revision_id: string | null;
    content_checksum: string;
    binding_count: number;
    actor_owner_id: string;
    actor_email: string | null;
    reason: string;
    created_at: Date | string;
  }>;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    revisionNumber: Number(row.revision_number),
    previousRevisionId: row.previous_revision_id,
    contentChecksum: row.content_checksum,
    bindingCount: row.binding_count,
    actorOwnerId: row.actor_owner_id,
    actorEmail: row.actor_email,
    reason: row.reason,
    createdAt: iso(row.created_at)!,
  } satisfies AxRegistryRevision;
}

export async function listIdentityRegistryRevisions(limit = 50) {
  const rows = (await getDb().execute(sql<{
    id: string;
    revision_number: number;
    previous_revision_id: string | null;
    content_checksum: string;
    binding_count: number;
    actor_owner_id: string;
    actor_email: string | null;
    reason: string;
    created_at: Date | string;
  }>`
    select * from private.ax_registry_revisions
    order by revision_number desc
    limit ${Math.max(1, Math.min(200, limit))}
  `)) as unknown as Array<{
    id: string;
    revision_number: number;
    previous_revision_id: string | null;
    content_checksum: string;
    binding_count: number;
    actor_owner_id: string;
    actor_email: string | null;
    reason: string;
    created_at: Date | string;
  }>;
  return rows.map(
    (row): AxRegistryRevision => ({
      id: row.id,
      revisionNumber: Number(row.revision_number),
      previousRevisionId: row.previous_revision_id,
      contentChecksum: row.content_checksum,
      bindingCount: row.binding_count,
      actorOwnerId: row.actor_owner_id,
      actorEmail: row.actor_email,
      reason: row.reason,
      createdAt: iso(row.created_at)!,
    }),
  );
}

export async function getAxIdentityAuthorityStatus(): Promise<AxIdentityAuthorityStatus> {
  const rows = (await getDb().execute(sql<{
    environment: string;
    registry_revision_id: string;
    revision_number: number;
    rules_checksum: string;
    formatter_checksum: string;
    activated_at: Date | string;
  }>`
    select authority.environment, authority.registry_revision_id,
      revision.revision_number, authority.rules_checksum,
      authority.formatter_checksum, authority.created_at as activated_at
    from private.ax_identity_authorities as authority
    join private.ax_registry_revisions as revision
      on revision.id = authority.registry_revision_id
    where authority.namespace = 'people-groups'
    limit 1
  `)) as unknown as Array<{
    environment: string;
    registry_revision_id: string;
    revision_number: number;
    rules_checksum: string;
    formatter_checksum: string;
    activated_at: Date | string;
  }>;
  const row = rows[0];
  return row
    ? {
        initialized: true,
        environment: row.environment,
        registryRevisionId: row.registry_revision_id,
        revisionNumber: Number(row.revision_number),
        rulesChecksum: row.rules_checksum,
        formatterChecksum: row.formatter_checksum,
        activatedAt: iso(row.activated_at),
      }
    : {
        initialized: false,
        environment: null,
        registryRevisionId: null,
        revisionNumber: null,
        rulesChecksum: null,
        formatterChecksum: null,
        activatedAt: null,
      };
}
