import { describe, expect, it, vi } from "vitest";

import { captureOperationalEvent } from "@/lib/operational-alert-capture";

import {
  executePipelineContinuation,
  executeOnePipelineStage,
  PipelineStageExecutionError,
  type PipelineExecutorDependencies,
} from "./executor";
import type { PipelineRunDetail, PipelineStageClaim } from "./types";

vi.mock("@/lib/operational-alert-capture", () => ({
  captureOperationalEvent: vi.fn().mockResolvedValue({ queued: true }),
}));

const captureOperationalEventMock = vi.mocked(captureOperationalEvent);

const claim: PipelineStageClaim = {
  stageId: "stage-1",
  attemptId: "attempt-1",
  flowRunId: "run-1",
  definitionKey: "source-imb-people-groups",
  actorOwnerId: "admin-1",
  actorEmail: "admin@example.com",
  stageKey: "imb-ingest",
  stageKind: "ingestion",
  effectKey: "source-ingestion",
  exactInputs: {},
  attemptNumber: 1,
  maxAttempts: 3,
  leaseExpiresAt: "2026-07-23T00:00:00.000Z",
};

function dependencies(overrides?: Partial<PipelineExecutorDependencies>) {
  return {
    claim: vi.fn().mockResolvedValue(claim),
    complete: vi.fn().mockResolvedValue("queued"),
    fail: vi.fn().mockResolvedValue("queued"),
    progress: vi.fn().mockResolvedValue(true),
    getRun: vi.fn().mockResolvedValue({ status: "queued" } as PipelineRunDetail),
    ...overrides,
  } satisfies PipelineExecutorDependencies;
}

describe("bounded pipeline executor", () => {
  it("runs one claimed effect, heartbeats progress, and completes it", async () => {
    const deps = dependencies();
    const handler = vi.fn(async (context) => {
      await context.reportProgress(1, 2);
      return { outcome: "succeeded" as const, output: { artifactId: "artifact-1" } };
    });

    const result = await executeOnePipelineStage({
      runId: "run-1",
      workerId: "worker-1",
      handlers: { "source-ingestion": handler },
      dependencies: deps,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(deps.progress).toHaveBeenCalledWith(
      expect.objectContaining({ attemptId: "attempt-1", current: 1, total: 2 }),
    );
    expect(deps.complete).toHaveBeenCalledWith(
      expect.objectContaining({ result: expect.objectContaining({ outcome: "succeeded" }) }),
    );
    expect(result.status).toBe("queued");
  });

  it("turns an explicit review stage into an awaiting-review result", async () => {
    const deps = dependencies({
      claim: vi.fn().mockResolvedValue({ ...claim, stageKind: "review" }),
      complete: vi.fn().mockResolvedValue("awaiting_review"),
    });
    const result = await executeOnePipelineStage({
      runId: "run-1",
      handlers: {},
      dependencies: deps,
    });
    expect(result.result?.outcome).toBe("awaiting_review");
    expect(deps.fail).not.toHaveBeenCalled();
  });

  it("fails closed when a stage adapter is unavailable", async () => {
    captureOperationalEventMock.mockClear();
    const deps = dependencies({ fail: vi.fn().mockResolvedValue("failed") });
    const result = await executeOnePipelineStage({
      runId: "run-1",
      handlers: {},
      dependencies: deps,
    });
    expect(deps.fail).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: "stage-adapter-missing", retryable: false }),
    );
    expect(result.status).toBe("failed");
    expect(captureOperationalEventMock).toHaveBeenCalledWith({
      kind: "pipeline-run-failed",
      runId: "run-1",
      flowKey: "source-imb-people-groups",
      stageKey: "imb-ingest",
      effectKey: "source-ingestion",
      errorCode: "stage-adapter-missing",
    });
  });

  it("retains retryability declared by a handler error", async () => {
    captureOperationalEventMock.mockClear();
    const deps = dependencies();
    await executeOnePipelineStage({
      runId: "run-1",
      handlers: {
        "source-ingestion": async () => {
          throw new PipelineStageExecutionError("Provider unavailable", {
            code: "provider-unavailable",
            retryable: true,
          });
        },
      },
      dependencies: deps,
    });
    expect(deps.fail).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: "provider-unavailable", retryable: true }),
    );
    expect(captureOperationalEventMock).not.toHaveBeenCalled();
  });

  it("does nothing when a duplicate continuation cannot claim work", async () => {
    const deps = dependencies({ claim: vi.fn().mockResolvedValue(null) });
    const result = await executeOnePipelineStage({
      runId: "run-1",
      handlers: {},
      dependencies: deps,
    });
    expect(result.claim).toBeNull();
    expect(deps.complete).not.toHaveBeenCalled();
    expect(deps.fail).not.toHaveBeenCalled();
  });

  it("renews the lease for a handler that runs longer than one heartbeat interval", async () => {
    vi.useFakeTimers();
    try {
      let releaseHandler!: () => void;
      let markStarted!: () => void;
      const handlerReleased = new Promise<void>((resolve) => {
        releaseHandler = resolve;
      });
      const handlerStarted = new Promise<void>((resolve) => {
        markStarted = resolve;
      });
      const deps = dependencies();
      const execution = executeOnePipelineStage({
        runId: "run-1",
        workerId: "worker-1",
        leaseSeconds: 3,
        handlers: {
          "source-ingestion": async () => {
            markStarted();
            await handlerReleased;
            return { outcome: "succeeded" as const };
          },
        },
        dependencies: deps,
      });

      await handlerStarted;
      await vi.advanceTimersByTimeAsync(1_100);
      expect(deps.progress).toHaveBeenCalledWith(
        expect.objectContaining({
          attemptId: "attempt-1",
          current: 0,
          total: 1,
          leaseSeconds: 3,
        }),
      );
      releaseHandler();
      await execution;
      expect(deps.complete).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not persist raw diagnostics from an untyped error", async () => {
    const deps = dependencies({ fail: vi.fn().mockResolvedValue("failed") });
    await executeOnePipelineStage({
      runId: "run-1",
      handlers: {
        "source-ingestion": async () => {
          throw new Error("provider token super-secret-value was rejected");
        },
      },
      dependencies: deps,
    });

    expect(deps.fail).toHaveBeenCalledWith(
      expect.objectContaining({
        errorMessage:
          "The pipeline stage could not be completed. Protected logs contain the diagnostic details.",
      }),
    );
    expect(JSON.stringify(vi.mocked(deps.fail).mock.calls)).not.toContain(
      "super-secret-value",
    );
  });

  it("continues through more than the old three-stage budget until a review gate", async () => {
    const claims = [
      ...Array.from({ length: 6 }, (_, index) => ({
        ...claim,
        stageId: `stage-${index + 1}`,
        attemptId: `attempt-${index + 1}`,
        stageKey: `effect-${index + 1}`,
      })),
      {
        ...claim,
        stageId: "stage-review",
        attemptId: "attempt-review",
        stageKey: "operator-review",
        stageKind: "review" as const,
      },
    ];
    const claimNext = vi.fn();
    for (const nextClaim of claims) claimNext.mockResolvedValueOnce(nextClaim);
    const complete = vi
      .fn()
      .mockResolvedValueOnce("queued")
      .mockResolvedValueOnce("queued")
      .mockResolvedValueOnce("queued")
      .mockResolvedValueOnce("queued")
      .mockResolvedValueOnce("queued")
      .mockResolvedValueOnce("queued")
      .mockResolvedValueOnce("awaiting_review");
    const deps = dependencies({ claim: claimNext, complete });

    const result = await executePipelineContinuation({
      runId: "run-1",
      handlers: {
        "source-ingestion": async () => ({ outcome: "succeeded" }),
      },
      maxUnits: 10,
      dependencies: deps,
    });

    expect(result.steps).toHaveLength(7);
    expect(result.steps.at(-1)?.status).toBe("awaiting_review");
    expect(claimNext).toHaveBeenCalledTimes(7);
    expect(result.budgetExhausted).toBe(false);
  });

  it("stops before claiming work after the invocation deadline", async () => {
    const deps = dependencies();
    const result = await executePipelineContinuation({
      runId: "run-1",
      handlers: {},
      maxUnits: 25,
      deadlineAtMs: Date.now() - 1,
      dependencies: deps,
    });
    expect(result.steps).toEqual([]);
    expect(result.budgetExhausted).toBe(true);
    expect(deps.claim).not.toHaveBeenCalled();
  });
});
