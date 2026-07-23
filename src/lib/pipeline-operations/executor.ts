import { logError, normalizeErrorForLogging } from "@/lib/error-logging";

import {
  claimPipelineStage,
  completePipelineStage,
  failPipelineStage,
  getPipelineFlowRun,
  newPipelineWorkerId,
  updatePipelineStageProgress,
} from "./repository";
import type {
  PipelineRunDetail,
  PipelineStageClaim,
  PipelineStageHandlers,
  PipelineStageResult,
} from "./types";

export class PipelineStageExecutionError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, options?: { code?: string; retryable?: boolean }) {
    super(message);
    this.name = "PipelineStageExecutionError";
    this.code = options?.code ?? "stage-execution-failed";
    this.retryable = options?.retryable ?? true;
  }
}

export type PipelineExecutorDependencies = Readonly<{
  claim: typeof claimPipelineStage;
  complete: typeof completePipelineStage;
  fail: typeof failPipelineStage;
  progress: typeof updatePipelineStageProgress;
  getRun: typeof getPipelineFlowRun;
}>;

const defaultDependencies: PipelineExecutorDependencies = {
  claim: claimPipelineStage,
  complete: completePipelineStage,
  fail: failPipelineStage,
  progress: updatePipelineStageProgress,
  getRun: getPipelineFlowRun,
};

export type PipelineExecutionStep = Readonly<{
  claim: PipelineStageClaim | null;
  status: PipelineRunDetail["status"] | null;
  result: PipelineStageResult | null;
}>;

export async function executeOnePipelineStage(input: {
  runId: string;
  handlers: PipelineStageHandlers;
  workerId?: string;
  leaseSeconds?: number;
  dependencies?: PipelineExecutorDependencies;
}): Promise<PipelineExecutionStep> {
  const dependencies = input.dependencies ?? defaultDependencies;
  const workerId = input.workerId ?? newPipelineWorkerId();
  const claim = await dependencies.claim({
    runId: input.runId,
    workerId,
    leaseSeconds: input.leaseSeconds,
  });

  if (!claim) {
    return {
      claim: null,
      status: (await dependencies.getRun(input.runId))?.status ?? null,
      result: null,
    };
  }

  try {
    let result: PipelineStageResult;

    if (claim.stageKind === "review") {
      result = {
        outcome: "awaiting_review",
        output: {
          reviewGate: claim.stageKey,
          message: "An administrator must approve or reject this stage before the flow continues.",
        },
      };
    } else {
      const handler = input.handlers[claim.effectKey];
      if (!handler) {
        throw new PipelineStageExecutionError(
          `No bounded stage adapter is registered for ${claim.effectKey}.`,
          { code: "stage-adapter-missing", retryable: false },
        );
      }

      let heartbeatCurrent = 0;
      let heartbeatTotal = 1;
      let heartbeatError: unknown = null;
      let heartbeatChain = Promise.resolve();
      const renewLease = async () => {
        const updated = await dependencies.progress({
          attemptId: claim.attemptId,
          workerId,
          current: heartbeatCurrent,
          total: heartbeatTotal,
          leaseSeconds: input.leaseSeconds,
        });
        if (!updated) {
          throw new PipelineStageExecutionError(
            "The stage lease was lost while recording progress.",
            { code: "stage-lease-lost", retryable: true },
          );
        }
      };
      const leaseSeconds = Math.max(3, input.leaseSeconds ?? 60);
      const heartbeat = setInterval(() => {
        heartbeatChain = heartbeatChain
          .then(renewLease)
          .catch((error) => {
            heartbeatError = error;
          });
      }, Math.max(1_000, Math.floor((leaseSeconds * 1_000) / 3)));
      try {
        result = await handler({
          claim,
          reportProgress: async (current, total) => {
            heartbeatCurrent = current;
            heartbeatTotal = total;
            await renewLease();
          },
        });
        await heartbeatChain;
        if (heartbeatError) throw heartbeatError;
      } finally {
        clearInterval(heartbeat);
      }
    }

    const status = await dependencies.complete({
      attemptId: claim.attemptId,
      workerId,
      result,
    });
    return { claim, status, result };
  } catch (error) {
    logError(
      `Pipeline stage execution failed (${claim.flowRunId}/${claim.stageKey}/${claim.effectKey})`,
      error,
    );
    const normalized = normalizeErrorForLogging(error);
    const executionError =
      error instanceof PipelineStageExecutionError
        ? error
        : new PipelineStageExecutionError(normalized.message, {
            code: typeof normalized.code === "string" ? normalized.code : undefined,
          });

    const status = await dependencies.fail({
      attemptId: claim.attemptId,
      workerId,
      errorCode: executionError.code,
      errorMessage:
        error instanceof PipelineStageExecutionError
          ? error.message
          : "The pipeline stage could not be completed. Protected logs contain the diagnostic details.",
      retryable: executionError.retryable,
    });
    return { claim, status, result: null };
  }
}

export async function executePipelineContinuation(input: {
  runId: string;
  handlers: PipelineStageHandlers;
  maxUnits?: number;
  workerId?: string;
  leaseSeconds?: number;
  deadlineAtMs?: number;
  dependencies?: PipelineExecutorDependencies;
}) {
  const maxUnits = Math.max(1, Math.min(input.maxUnits ?? 1, 25));
  const steps: PipelineExecutionStep[] = [];
  let budgetExhausted = false;

  for (let index = 0; index < maxUnits; index += 1) {
    if (input.deadlineAtMs !== undefined && Date.now() >= input.deadlineAtMs) {
      budgetExhausted = true;
      break;
    }
    const step = await executeOnePipelineStage({
      ...input,
      workerId: input.workerId ?? newPipelineWorkerId("pipeline-continuation"),
    });
    steps.push(step);
    if (
      !step.claim ||
      step.status === "awaiting_review" ||
      step.status === "failed" ||
      step.status === "succeeded" ||
      step.status === "cancelled"
    ) {
      break;
    }
  }

  return {
    steps,
    run: await (input.dependencies ?? defaultDependencies).getRun(input.runId),
    budgetExhausted,
  };
}
