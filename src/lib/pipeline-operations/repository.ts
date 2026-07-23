import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";

import { getPipelineFlowDefinition } from "./registry";
import { snapshotCurrentPipelineInputs } from "./inputs";
import { PIPELINE_MIN_SCHEDULE_INTERVAL_MINUTES } from "./schemas";
import { PipelineOperationError } from "./errors";
import { pipelineSourceCanaryMatchesCurrent } from "./source-execution";
import type {
  PipelineFlowDefinition,
  PipelineJsonObject,
  PipelineLaunchKind,
  PipelineRunDetail,
  PipelineRunEvent,
  PipelineRunSummary,
  PipelineScheduleState,
  PipelineStageAttempt,
  PipelineStageClaim,
  PipelineStageDetail,
  PipelineStageResult,
} from "./types";
import { fingerprintPipelineInputs } from "./validation";

type DateValue = string | Date;

type RunRow = {
  id: string;
  definitionKey: string;
  definitionVersion: string;
  definitionChecksum: string;
  correlationId: string;
  launchKind: PipelineLaunchKind;
  inputFingerprint: string;
  exactInputs?: PipelineJsonObject;
  status: PipelineRunSummary["status"];
  currentStageKey: string | null;
  actorOwnerId: string;
  actorEmail: string | null;
  progressCurrent: number;
  progressTotal: number;
  rowCount: number | null;
  warningCount: number;
  errorCount: number;
  publicationId: string | null;
  outOfDate: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  stageCount: number;
  completedStageCount: number;
  retryCount: number;
  startedAt: DateValue | null;
  completedAt: DateValue | null;
  createdAt: DateValue;
  updatedAt: DateValue;
};

type StageRow = {
  id: string;
  key: string;
  index: number;
  kind: PipelineStageDetail["kind"];
  effectKey: string;
  status: PipelineStageDetail["status"];
  maxAttempts: number;
  attemptCount: number;
  progressCurrent: number;
  progressTotal: number;
  exactInputs: PipelineJsonObject;
  output: PipelineJsonObject;
  findingSummary: PipelineJsonObject;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: DateValue | null;
  completedAt: DateValue | null;
};

type AttemptRow = {
  id: string;
  stageId: string;
  attemptNumber: number;
  workerId: string;
  status: PipelineStageAttempt["status"];
  retryable: boolean | null;
  progress: PipelineJsonObject;
  output: PipelineJsonObject;
  findingSummary: PipelineJsonObject;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: DateValue;
  heartbeatAt: DateValue;
  completedAt: DateValue | null;
};

type EventRow = Omit<PipelineRunEvent, "createdAt"> & { createdAt: DateValue };

function iso(value: DateValue) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function isoOrNull(value: DateValue | null) {
  return value ? iso(value) : null;
}

function toRunSummary(row: RunRow): PipelineRunSummary {
  const currentDefinition = getPipelineFlowDefinition(row.definitionKey);
  return {
    ...row,
    outOfDate:
      row.outOfDate ||
      !currentDefinition ||
      currentDefinition.checksum !== row.definitionChecksum,
    startedAt: isoOrNull(row.startedAt),
    completedAt: isoOrNull(row.completedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

const runSelection = sql`
  r.id,
  r.definition_key as "definitionKey",
  r.definition_version as "definitionVersion",
  r.definition_checksum as "definitionChecksum",
  r.correlation_id as "correlationId",
  r.launch_kind as "launchKind",
  r.input_fingerprint as "inputFingerprint",
  r.status,
  r.current_stage_key as "currentStageKey",
  r.actor_owner_id as "actorOwnerId",
  r.actor_email as "actorEmail",
  r.progress_current as "progressCurrent",
  r.progress_total as "progressTotal",
  r.row_count as "rowCount",
  r.warning_count as "warningCount",
  r.error_count as "errorCount",
  r.publication_id as "publicationId",
  r.out_of_date as "outOfDate",
  r.error_code as "errorCode",
  r.error_message as "errorMessage",
  (select count(*)::integer from private.pipeline_flow_stages s where s.flow_run_id = r.id) as "stageCount",
  (select count(*)::integer from private.pipeline_flow_stages s where s.flow_run_id = r.id and s.status in ('succeeded', 'skipped')) as "completedStageCount",
  (select greatest(coalesce(sum(greatest(s.attempt_count - 1, 0)), 0), 0)::integer from private.pipeline_flow_stages s where s.flow_run_id = r.id) as "retryCount",
  r.started_at as "startedAt",
  r.completed_at as "completedAt",
  r.created_at as "createdAt",
  r.updated_at as "updatedAt"
`;

export function snapshotPipelineRunInputs(input: {
  definition: PipelineFlowDefinition;
  exactInputs: PipelineJsonObject;
}) {
  const definitionSnapshot = {
    key: input.definition.key,
    version: input.definition.version,
    checksum: input.definition.checksum,
    semanticDependencies: input.definition.semanticDependencies,
  };
  const exactInputs = {
    ...input.exactInputs,
    pipelineDefinition: definitionSnapshot,
  };
  return {
    exactInputs,
    inputFingerprint: fingerprintPipelineInputs(exactInputs),
  } as const;
}

export async function createPipelineFlowRun(input: {
  definition: PipelineFlowDefinition;
  launchKind: PipelineLaunchKind;
  exactInputs: PipelineJsonObject;
  idempotencyKey: string;
  actorOwnerId: string;
  actorEmail: string | null;
  parentRunId?: string | null;
}) {
  const { exactInputs, inputFingerprint } = snapshotPipelineRunInputs(input);

  return getDb().transaction(async (tx) => {
    const inserted = (await tx.execute(sql<{ id: string }>`
      insert into private.pipeline_flow_runs (
        definition_key, definition_version, definition_checksum,
        launch_kind, idempotency_key, input_fingerprint, exact_inputs,
        actor_owner_id, actor_email, parent_run_id, progress_total
      ) values (
        ${input.definition.key}, ${input.definition.version}, ${input.definition.checksum},
        ${input.launchKind}, ${input.idempotencyKey}, ${inputFingerprint},
        ${JSON.stringify(exactInputs)}::jsonb,
        ${input.actorOwnerId}, ${input.actorEmail}, ${input.parentRunId ?? null}::uuid,
        ${input.definition.stages.length}
      )
      on conflict (idempotency_key) do nothing
      returning id
    `)) as Array<{ id: string }>;

    let runId = inserted[0]?.id;
    const created = Boolean(runId);

    if (!runId) {
      const rows = (await tx.execute(sql<{ id: string }>`
        select id from private.pipeline_flow_runs where idempotency_key = ${input.idempotencyKey}
      `)) as Array<{ id: string }>;
      runId = rows[0]?.id;
    }

    if (!runId) throw new Error("Could not create or resolve the pipeline run.");

    if (created) {
      for (const [index, item] of input.definition.stages.entries()) {
        const stageInputs = {
          ...exactInputs,
          coordinator: {
            sourceProfileKey: item.sourceProfileKey ?? null,
            productKey: item.productKey ?? null,
            stageKey: item.key,
          },
        };
        await tx.execute(sql`
          insert into private.pipeline_flow_stages (
            flow_run_id, stage_key, stage_index, stage_kind, effect_key,
            status, max_attempts, progress_total, exact_inputs
          ) values (
            ${runId}::uuid, ${item.key}, ${index}, ${item.kind}, ${item.effectKey},
            ${index === 0 ? "queued" : "blocked"}, ${item.maxAttempts}, 1,
            ${JSON.stringify(stageInputs)}::jsonb
          )
        `);
      }

      await tx.execute(sql`
        insert into private.pipeline_run_events (
          flow_run_id, event_type, safe_message, details, actor_owner_id
        ) values (
          ${runId}::uuid, 'run-created', 'A pipeline run was created.',
          ${JSON.stringify({
            definitionKey: input.definition.key,
            launchKind: input.launchKind,
            inputFingerprint,
          })}::jsonb,
          ${input.actorOwnerId}
        )
      `);
    }

    const run = await getPipelineFlowRun(runId, tx);
    if (!run) throw new Error("The pipeline run could not be loaded.");
    return { run, created };
  });
}

type DbExecutor = ReturnType<typeof getDb>;

export async function listPipelineFlowRuns(input?: {
  limit?: number;
  status?: PipelineRunSummary["status"] | null;
  definitionKey?: string | null;
}) {
  const limit = Math.max(1, Math.min(input?.limit ?? 50, 200));
  const rows = (await getDb().execute(sql<RunRow>`
    select ${runSelection}
    from private.pipeline_flow_runs r
    where (${input?.status ?? null}::text is null or r.status = ${input?.status ?? null})
      and (${input?.definitionKey ?? null}::text is null or r.definition_key = ${input?.definitionKey ?? null})
    order by r.created_at desc, r.id desc
    limit ${limit}
  `)) as unknown as RunRow[];
  return rows.map(toRunSummary);
}

export async function getPipelineFlowRun(
  runId: string,
  executor: Pick<DbExecutor, "execute"> = getDb(),
): Promise<PipelineRunDetail | null> {
  const rows = (await executor.execute(sql<RunRow>`
    select ${runSelection}, r.exact_inputs as "exactInputs"
    from private.pipeline_flow_runs r
    where r.id = ${runId}::uuid
    limit 1
  `)) as unknown as RunRow[];
  const row = rows[0];
  if (!row) return null;

  const [stageRows, attemptRows, eventRows] = await Promise.all([
    executor.execute(sql<StageRow>`
      select id, stage_key as key, stage_index as index, stage_kind as kind,
        effect_key as "effectKey", status, max_attempts as "maxAttempts",
        attempt_count as "attemptCount", progress_current as "progressCurrent",
        progress_total as "progressTotal", exact_inputs as "exactInputs",
        output, finding_summary as "findingSummary", error_code as "errorCode",
        error_message as "errorMessage", started_at as "startedAt",
        completed_at as "completedAt"
      from private.pipeline_flow_stages
      where flow_run_id = ${runId}::uuid
      order by stage_index
    `),
    executor.execute(sql<AttemptRow>`
      select id, stage_id as "stageId", attempt_number as "attemptNumber",
        worker_id as "workerId", status, retryable, progress, output,
        finding_summary as "findingSummary", error_code as "errorCode",
        error_message as "errorMessage", started_at as "startedAt",
        heartbeat_at as "heartbeatAt", completed_at as "completedAt"
      from private.pipeline_stage_attempts
      where flow_run_id = ${runId}::uuid
      order by started_at, attempt_number
    `),
    executor.execute(sql<EventRow>`
      select id::integer, stage_id as "stageId", event_type as "eventType",
        safe_message as "safeMessage", details, actor_owner_id as "actorOwnerId",
        created_at as "createdAt"
      from private.pipeline_run_events
      where flow_run_id = ${runId}::uuid
      order by created_at, id
    `),
  ]);

  const attemptsByStage = new Map<string, PipelineStageAttempt[]>();
  for (const attempt of attemptRows as unknown as AttemptRow[]) {
    const mapped: PipelineStageAttempt = {
      ...attempt,
      startedAt: iso(attempt.startedAt),
      heartbeatAt: iso(attempt.heartbeatAt),
      completedAt: isoOrNull(attempt.completedAt),
    };
    attemptsByStage.set(attempt.stageId, [
      ...(attemptsByStage.get(attempt.stageId) ?? []),
      mapped,
    ]);
  }

  const stages = (stageRows as unknown as StageRow[]).map<PipelineStageDetail>((stage) => ({
    ...stage,
    startedAt: isoOrNull(stage.startedAt),
    completedAt: isoOrNull(stage.completedAt),
    attempts: attemptsByStage.get(stage.id) ?? [],
  }));

  return {
    ...toRunSummary(row),
    exactInputs: row.exactInputs ?? {},
    stages,
    events: (eventRows as unknown as EventRow[]).map((event) => ({
      ...event,
      createdAt: iso(event.createdAt),
    })),
  };
}

type PipelineDefinitionPin = Pick<
  PipelineRunSummary,
  "definitionKey" | "definitionVersion" | "definitionChecksum"
>;

export function isPipelineDefinitionCurrent(
  run: PipelineDefinitionPin | null,
) {
  if (!run) return false;
  const definition = getPipelineFlowDefinition(run.definitionKey);
  return Boolean(
    definition &&
      run.definitionVersion === definition.version &&
      run.definitionChecksum === definition.checksum,
  );
}

export function assertPipelineDefinitionCurrent(
  run: PipelineDefinitionPin | null,
): asserts run is PipelineDefinitionPin {
  if (!isPipelineDefinitionCurrent(run)) {
    throw new PipelineOperationError(
      "This run uses an older pipeline definition and cannot resume. Start a rebuild with current inputs.",
      409,
      "pipeline-definition-stale",
    );
  }
}

export async function claimPipelineStage(input: {
  runId: string;
  workerId: string;
  leaseSeconds?: number;
}) {
  const run = await getPipelineFlowRun(input.runId);
  if (!isPipelineDefinitionCurrent(run)) {
    return null;
  }
  const rows = (await getDb().execute(sql<{
    stageId: string;
    attemptId: string;
    flowRunId: string;
    definitionKey: string;
    actorOwnerId: string;
    actorEmail: string | null;
    stageKey: string;
    stageKind: PipelineStageClaim["stageKind"];
    effectKey: string;
    exactInputs: PipelineJsonObject;
    attemptNumber: number;
    maxAttempts: number;
    leaseExpiresAt: DateValue;
  }>`
    select
      stage_id as "stageId", attempt_id as "attemptId", flow_run_id as "flowRunId",
      definition_key as "definitionKey", actor_owner_id as "actorOwnerId",
      actor_email as "actorEmail", stage_key as "stageKey",
      stage_kind as "stageKind", effect_key as "effectKey", exact_inputs as "exactInputs",
      attempt_number as "attemptNumber", max_attempts as "maxAttempts",
      lease_expires_at as "leaseExpiresAt"
    from private.claim_pipeline_stage(
      ${input.runId}::uuid, ${input.workerId}, ${input.leaseSeconds ?? 60}
    )
  `)) as unknown as Array<Omit<PipelineStageClaim, "leaseExpiresAt"> & { leaseExpiresAt: DateValue }>;
  const claim = rows[0];
  if (!claim) return null;
  const detail = await getPipelineFlowRun(claim.flowRunId);
  const claimedStage = detail?.stages.find((stage) => stage.id === claim.stageId);
  const upstreamOutputs = Object.fromEntries(
    (detail?.stages ?? [])
      .filter((stage) => claimedStage && stage.index < claimedStage.index)
      .map((stage) => [stage.key, stage.output]),
  );
  return {
    ...claim,
    exactInputs: { ...claim.exactInputs, upstreamOutputs },
    leaseExpiresAt: iso(claim.leaseExpiresAt),
  };
}

export async function updatePipelineStageProgress(input: {
  attemptId: string;
  workerId: string;
  current: number;
  total: number;
  leaseSeconds?: number;
}) {
  const rows = (await getDb().execute(sql<{ updated: boolean }>`
    select private.update_pipeline_stage_progress(
      ${input.attemptId}::uuid, ${input.workerId}, ${input.current}, ${input.total},
      ${input.leaseSeconds ?? 60}
    ) as updated
  `)) as Array<{ updated: boolean }>;
  return rows[0]?.updated ?? false;
}

export async function completePipelineStage(input: {
  attemptId: string;
  workerId: string;
  result: PipelineStageResult;
}) {
  const rows = (await getDb().execute(sql<{ status: PipelineRunSummary["status"] }>`
    select private.complete_pipeline_stage(
      ${input.attemptId}::uuid, ${input.workerId}, ${input.result.outcome},
      ${JSON.stringify(input.result.output ?? {})}::jsonb,
      ${JSON.stringify(input.result.findingSummary ?? {})}::jsonb,
      ${input.result.rowCount ?? null}
    ) as status
  `)) as Array<{ status: PipelineRunSummary["status"] }>;
  return rows[0]?.status ?? null;
}

export async function failPipelineStage(input: {
  attemptId: string;
  workerId: string;
  errorCode: string;
  errorMessage: string;
  retryable?: boolean;
}) {
  const rows = (await getDb().execute(sql<{ status: PipelineRunSummary["status"] }>`
    select private.fail_pipeline_stage(
      ${input.attemptId}::uuid, ${input.workerId}, ${input.errorCode},
      ${input.errorMessage}, ${input.retryable ?? true}
    ) as status
  `)) as Array<{ status: PipelineRunSummary["status"] }>;
  return rows[0]?.status ?? null;
}

export async function resumePipelineReview(input: {
  runId: string;
  stageKey: string;
  actorOwnerId: string;
  decision: "approve" | "reject";
  reason: string;
  acknowledgeWarnings?: boolean;
}) {
  const run = await getPipelineFlowRun(input.runId);
  assertPipelineDefinitionCurrent(run);
  const rows = (await getDb().execute(sql<{ status: PipelineRunSummary["status"] }>`
    select private.resume_pipeline_review(
      ${input.runId}::uuid, ${input.stageKey}, ${input.actorOwnerId},
      ${input.decision}, ${input.reason}, ${input.acknowledgeWarnings ?? false}
    ) as status
  `)) as Array<{ status: PipelineRunSummary["status"] }>;
  return rows[0]?.status ?? null;
}

export async function retryPipelineStage(input: {
  runId: string;
  stageKey: string;
  actorOwnerId: string;
  reason: string;
}) {
  const rows = (await getDb().execute(sql<{ retried: boolean }>`
    select private.retry_pipeline_stage(
      ${input.runId}::uuid, ${input.stageKey}, ${input.actorOwnerId}, ${input.reason}
    ) as retried
  `)) as Array<{ retried: boolean }>;
  return rows[0]?.retried ?? false;
}

export async function recoverStalePipelineStages(runId?: string | null) {
  const rows = (await getDb().execute(sql<{ recovered: number }>`
    select private.recover_stale_pipeline_stages(${runId ?? null}::uuid) as recovered
  `)) as Array<{ recovered: number }>;
  return rows[0]?.recovered ?? 0;
}

export async function listPipelineScheduleStates() {
  const rows = (await getDb().execute(sql<{
    definitionKey: string;
    sourceProfileId: string | null;
    enabled: boolean;
    intervalMinutes: number;
    manualCanaryRunId: string | null;
    manualCanaryVerifiedAt: DateValue | null;
    manualCanaryVerifiedBy: string | null;
    lastEnqueuedAt: DateValue | null;
    updatedAt: DateValue;
  }>`
    select definition_key as "definitionKey",
      source_profile_id as "sourceProfileId", enabled,
      interval_minutes as "intervalMinutes",
      manual_canary_run_id as "manualCanaryRunId",
      manual_canary_verified_at as "manualCanaryVerifiedAt",
      manual_canary_verified_by as "manualCanaryVerifiedBy",
      last_enqueued_at as "lastEnqueuedAt", updated_at as "updatedAt"
    from private.pipeline_schedule_states
    order by definition_key, source_profile_id nulls first
  `)) as unknown as Array<Omit<PipelineScheduleState, "manualCanaryVerifiedAt" | "lastEnqueuedAt" | "updatedAt"> & {
    manualCanaryVerifiedAt: DateValue | null;
    lastEnqueuedAt: DateValue | null;
    updatedAt: DateValue;
  }>;
  return rows.map<PipelineScheduleState>((row) => ({
    ...row,
    manualCanaryVerifiedAt: isoOrNull(row.manualCanaryVerifiedAt),
    lastEnqueuedAt: isoOrNull(row.lastEnqueuedAt),
    updatedAt: iso(row.updatedAt),
  }));
}

export async function isPipelineScheduleSourceProfileActive(
  definitionKey: string,
  sourceProfileId: string | null,
) {
  if (definitionKey !== "tier2-partner") return sourceProfileId === null;
  if (!sourceProfileId) return false;
  const rows = (await getDb().execute(sql<{
    id: string;
    exactInputs: PipelineJsonObject;
  }>`
    select id, exact_inputs as "exactInputs"
    from private.tier2_partner_profiles
    where id = ${sourceProfileId}::uuid and active
    limit 1
  `)) as Array<{ id: string }>;
  return Boolean(rows[0]);
}

export async function configurePipelineSchedule(input: {
  definitionKey: string;
  sourceProfileId?: string | null;
  enabled: boolean;
  intervalMinutes: number;
  canaryRunId: string;
  actorOwnerId: string;
}) {
  if (input.intervalMinutes < PIPELINE_MIN_SCHEDULE_INTERVAL_MINUTES) {
    throw new PipelineOperationError(
      "Scheduled pipelines can run no more frequently than once per day on this deployment.",
      409,
      "schedule-interval-too-frequent",
    );
  }
  const definition = getPipelineFlowDefinition(input.definitionKey);
  if (!definition?.scheduleEligible) {
    throw new PipelineOperationError(
      "This pipeline definition is not eligible for scheduling.",
      409,
      "schedule-definition-ineligible",
    );
  }

  const sourceProfileId = input.sourceProfileId ?? null;
  if (input.definitionKey === "tier2-partner" && !sourceProfileId) {
    throw new PipelineOperationError(
      "An active Tier 2 partner profile is required for this schedule.",
      409,
      "schedule-profile-required",
    );
  }
  if (input.definitionKey !== "tier2-partner" && sourceProfileId) {
    throw new PipelineOperationError(
      "This pipeline definition does not accept a partner profile.",
      409,
      "schedule-profile-not-supported",
    );
  }

  if (!(await isPipelineScheduleSourceProfileActive(input.definitionKey, sourceProfileId))) {
    throw new PipelineOperationError(
      "The selected Tier 2 partner profile is not active.",
      409,
      "schedule-profile-inactive",
    );
  }

  const rows = (await getDb().execute(sql<{
    id: string;
    exactInputs: PipelineJsonObject;
  }>`
    select id, exact_inputs as "exactInputs"
    from private.pipeline_flow_runs
    where id = ${input.canaryRunId}::uuid
      and definition_key = ${input.definitionKey}
      and definition_version = ${definition.version}
      and definition_checksum = ${definition.checksum}
      and launch_kind = 'manual'
      and status = 'succeeded'
      and (
        (${sourceProfileId}::uuid is null and ${input.definitionKey} <> 'tier2-partner')
        or exact_inputs ->> 'profileId' = ${sourceProfileId}
      )
    limit 1
  `)) as Array<{ id: string; exactInputs: PipelineJsonObject }>;
  if (!rows[0]) {
    throw new PipelineOperationError(
      "A successful manual canary for this definition is required.",
      409,
      "schedule-canary-required",
    );
  }
  const currentSnapshot = await snapshotCurrentPipelineInputs();
  const currentExactInputs = sourceProfileId
    ? { ...currentSnapshot, profileId: sourceProfileId }
    : currentSnapshot;
  if (!pipelineSourceCanaryMatchesCurrent({
    definition,
    canaryExactInputs: rows[0].exactInputs,
    currentExactInputs,
  })) {
    throw new PipelineOperationError(
      "The source configuration changed after this canary ran. Complete a new manual canary before scheduling.",
      409,
      "schedule-canary-inputs-stale",
    );
  }

  await getDb().execute(sql`
    insert into private.pipeline_schedule_states (
      definition_key, source_profile_id, enabled, interval_minutes, manual_canary_run_id,
      manual_canary_verified_at, manual_canary_verified_by
    ) values (
      ${input.definitionKey}, ${sourceProfileId}::uuid,
      ${input.enabled}, ${input.intervalMinutes},
      ${input.canaryRunId}::uuid, now(), ${input.actorOwnerId}
    )
    on conflict on constraint pipeline_schedule_states_identity_unique do update
    set enabled = excluded.enabled, interval_minutes = excluded.interval_minutes,
      manual_canary_run_id = excluded.manual_canary_run_id,
      manual_canary_verified_at = excluded.manual_canary_verified_at,
      manual_canary_verified_by = excluded.manual_canary_verified_by,
      updated_at = now()
  `);
}

export async function getDuePipelineSchedules() {
  const rows = (await getDb().execute(sql<{
    definitionKey: string;
    sourceProfileId: string | null;
    intervalMinutes: number;
    canaryDefinitionVersion: string;
    canaryDefinitionChecksum: string;
    canaryStatus: PipelineRunSummary["status"];
    canaryLaunchKind: PipelineLaunchKind;
    canaryExactInputs: PipelineJsonObject;
  }>`
    select schedule.definition_key as "definitionKey",
      schedule.source_profile_id as "sourceProfileId",
      schedule.interval_minutes as "intervalMinutes",
      canary.definition_version as "canaryDefinitionVersion",
      canary.definition_checksum as "canaryDefinitionChecksum",
      canary.status as "canaryStatus", canary.launch_kind as "canaryLaunchKind",
      canary.exact_inputs as "canaryExactInputs"
    from private.pipeline_schedule_states as schedule
    join private.pipeline_flow_runs as canary
      on canary.id = schedule.manual_canary_run_id
    left join private.tier2_partner_profiles as profile
      on profile.id = schedule.source_profile_id
    where schedule.enabled
      and schedule.manual_canary_verified_at is not null
      and (schedule.source_profile_id is null or profile.active)
      and (
        schedule.definition_key <> 'tier2-partner'
        or canary.exact_inputs ->> 'profileId' = schedule.source_profile_id::text
      )
      and (schedule.last_enqueued_at is null
        or schedule.last_enqueued_at <= now() - make_interval(mins => schedule.interval_minutes))
    order by schedule.definition_key, schedule.source_profile_id nulls first
    for update of schedule skip locked
  `)) as unknown as Array<{
    definitionKey: string;
    sourceProfileId: string | null;
    intervalMinutes: number;
    canaryDefinitionVersion: string;
    canaryDefinitionChecksum: string;
    canaryStatus: PipelineRunSummary["status"];
    canaryLaunchKind: PipelineLaunchKind;
    canaryExactInputs: PipelineJsonObject;
  }>;
  const currentSnapshot = rows.length > 0
    ? await snapshotCurrentPipelineInputs()
    : null;
  return rows
    .filter((row) => {
      const definition = getPipelineFlowDefinition(row.definitionKey);
      return Boolean(
        definition?.scheduleEligible &&
        row.canaryStatus === "succeeded" &&
        row.canaryLaunchKind === "manual" &&
        row.canaryDefinitionVersion === definition.version &&
        row.canaryDefinitionChecksum === definition.checksum &&
        currentSnapshot &&
        pipelineSourceCanaryMatchesCurrent({
          definition,
          canaryExactInputs: row.canaryExactInputs,
          currentExactInputs: row.sourceProfileId
            ? { ...currentSnapshot, profileId: row.sourceProfileId }
            : currentSnapshot,
        }),
      );
    })
    .map(({ definitionKey, sourceProfileId, intervalMinutes, canaryExactInputs }) => ({
      definitionKey,
      sourceProfileId,
      intervalMinutes,
      canaryExactInputs,
    }));
}

export async function markPipelineScheduleEnqueued(
  definitionKey: string,
  sourceProfileId: string | null = null,
) {
  await getDb().execute(sql`
    update private.pipeline_schedule_states
    set last_enqueued_at = now(), updated_at = now()
    where definition_key = ${definitionKey}
      and source_profile_id is not distinct from ${sourceProfileId}::uuid
      and enabled
  `);
}

export function newPipelineWorkerId(prefix = "pipeline") {
  return `${prefix}:${randomUUID()}`;
}
