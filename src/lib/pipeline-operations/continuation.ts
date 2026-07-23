import { executePipelineContinuation } from "./executor";
import { registeredPipelineStageHandlers } from "./handlers";

export const PIPELINE_CONTINUATION_MAX_UNITS = 25;
export const PIPELINE_CONTINUATION_BUDGET_MS = 240_000;

export function newPipelineContinuationDeadline(now = Date.now()) {
  return now + PIPELINE_CONTINUATION_BUDGET_MS;
}

export async function executePipelineUntilPause(input: {
  runId: string;
  deadlineAtMs?: number;
  workerId?: string;
}) {
  return executePipelineContinuation({
    runId: input.runId,
    handlers: registeredPipelineStageHandlers,
    maxUnits: PIPELINE_CONTINUATION_MAX_UNITS,
    deadlineAtMs: input.deadlineAtMs ?? newPipelineContinuationDeadline(),
    workerId: input.workerId,
  });
}
