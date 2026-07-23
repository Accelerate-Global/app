import { logError } from "@/lib/error-logging";
import { recoverStalePipelinePublications } from "@/lib/pipeline-products";
import {
  createPipelineFlowRun,
  executePipelineUntilPause,
  getDuePipelineSchedules,
  getPipelineFlowDefinition,
  isPipelineScheduleSourceProfileActive,
  isAuthorizedPipelineScheduleRequest,
  listPipelineFlowRuns,
  markPipelineScheduleEnqueued,
  pipelineSourceCanaryMatchesCurrent,
  recoverStalePipelineStages,
  newPipelineContinuationDeadline,
  snapshotCurrentPipelineInputs,
} from "@/lib/pipeline-operations";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

export async function GET(request: Request) {
  const secret = process.env.PIPELINE_SCHEDULE_SECRET ?? process.env.CRON_SECRET;
  if (!secret) {
    return response({ ok: false, error: "Pipeline scheduling is not configured." }, 500);
  }
  if (!isAuthorizedPipelineScheduleRequest(request, secret)) {
    return response({ ok: false, error: "Unauthorized." }, 401);
  }

  try {
    const deadlineAtMs = newPipelineContinuationDeadline();
    const [recovered, recoveredPublications] = await Promise.all([
      recoverStalePipelineStages(),
      recoverStalePipelinePublications(),
    ]);
    let continued = 0;
    const due = await getDuePipelineSchedules();
    let enqueued = 0;
    const newlyCreatedRunIds = new Set<string>();
    for (const schedule of due.slice(0, 5)) {
      if (Date.now() >= deadlineAtMs - 5_000) break;
      const definition = getPipelineFlowDefinition(schedule.definitionKey);
      if (!definition?.scheduleEligible) continue;
      if (!(await isPipelineScheduleSourceProfileActive(
        schedule.definitionKey,
        schedule.sourceProfileId,
      ))) continue;
      const slot = Math.floor(Date.now() / (schedule.intervalMinutes * 60_000));
      const currentInputs = await snapshotCurrentPipelineInputs();
      const exactInputs = schedule.sourceProfileId
        ? { ...currentInputs, profileId: schedule.sourceProfileId }
        : currentInputs;
      if (!pipelineSourceCanaryMatchesCurrent({
        definition,
        canaryExactInputs: schedule.canaryExactInputs,
        currentExactInputs: exactInputs,
      })) continue;
      const scheduleIdentity = schedule.sourceProfileId ?? "default";
      const result = await createPipelineFlowRun({
        definition,
        launchKind: "schedule",
        exactInputs,
        idempotencyKey: `schedule:${definition.key}:${scheduleIdentity}:${slot}`,
        actorOwnerId: "vercel-schedule",
        actorEmail: null,
      });
      await markPipelineScheduleEnqueued(definition.key, schedule.sourceProfileId);
      if (result.created) {
        enqueued += 1;
        newlyCreatedRunIds.add(result.run.id);
        const execution = await executePipelineUntilPause({
          runId: result.run.id,
          deadlineAtMs,
          workerId: `pipeline-schedule:${result.run.id}`,
        });
        if (execution.steps.some((step) => step.claim)) continued += 1;
      }
    }

    const pending = await listPipelineFlowRuns({ status: "queued", limit: 10 });
    for (const run of pending) {
      if (Date.now() >= deadlineAtMs - 5_000) break;
      if (newlyCreatedRunIds.has(run.id)) continue;
      const result = await executePipelineUntilPause({
        runId: run.id,
        deadlineAtMs,
        workerId: `pipeline-schedule:${run.id}`,
      });
      if (result.steps.some((step) => step.claim)) continued += 1;
    }

    return response({
      ok: true,
      recovered,
      recoveredPublications,
      continued,
      enqueued,
    });
  } catch (error) {
    logError("Pipeline schedule continuation failed", error);
    return response({ ok: false, error: "Pipeline scheduling failed." }, 503);
  }
}
