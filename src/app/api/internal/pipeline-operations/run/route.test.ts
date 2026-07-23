import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createPipelineFlowRun,
  executePipelineUntilPause,
  getDuePipelineSchedules,
  isPipelineScheduleSourceProfileActive,
  listPipelineFlowRuns,
  markPipelineScheduleEnqueued,
  newPipelineContinuationDeadline,
  pipelineSourceCanaryMatchesCurrent,
  recoverStalePipelineStages,
  snapshotCurrentPipelineInputs,
} from "@/lib/pipeline-operations";
import { recoverStalePipelinePublications } from "@/lib/pipeline-products";

import { GET } from "./route";

vi.mock("@/lib/error-logging", () => ({ logError: vi.fn() }));
vi.mock("@/lib/pipeline-products", () => ({
  recoverStalePipelinePublications: vi.fn(),
}));
vi.mock("@/lib/pipeline-operations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pipeline-operations")>(
    "@/lib/pipeline-operations",
  );
  return {
    ...actual,
    createPipelineFlowRun: vi.fn(),
    executePipelineUntilPause: vi.fn(),
    getDuePipelineSchedules: vi.fn(),
    isPipelineScheduleSourceProfileActive: vi.fn(),
    listPipelineFlowRuns: vi.fn(),
    markPipelineScheduleEnqueued: vi.fn(),
    newPipelineContinuationDeadline: vi.fn(),
    pipelineSourceCanaryMatchesCurrent: vi.fn(),
    recoverStalePipelineStages: vi.fn(),
    snapshotCurrentPipelineInputs: vi.fn(),
  };
});

describe("internal pipeline scheduler", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.CRON_SECRET = "cron-secret";
    delete process.env.PIPELINE_SCHEDULE_SECRET;
    vi.mocked(recoverStalePipelineStages).mockResolvedValue(0);
    vi.mocked(recoverStalePipelinePublications).mockResolvedValue(0);
    vi.mocked(listPipelineFlowRuns).mockResolvedValue([]);
    vi.mocked(getDuePipelineSchedules).mockResolvedValue([]);
    vi.mocked(isPipelineScheduleSourceProfileActive).mockResolvedValue(true);
    vi.mocked(snapshotCurrentPipelineInputs).mockResolvedValue({ capturedAt: "now" });
    vi.mocked(newPipelineContinuationDeadline).mockReturnValue(Date.now() + 100_000);
    vi.mocked(pipelineSourceCanaryMatchesCurrent).mockReturnValue(true);
  });

  it("rejects a request without the Vercel cron bearer secret", async () => {
    const response = await GET(
      new Request("http://localhost/api/internal/pipeline-operations/run"),
    );
    expect(response.status).toBe(401);
    expect(recoverStalePipelineStages).not.toHaveBeenCalled();
  });

  it("recovers stale work and advances only bounded queued runs", async () => {
    vi.mocked(recoverStalePipelineStages).mockResolvedValue(2);
    vi.mocked(recoverStalePipelinePublications).mockResolvedValue(1);
    vi.mocked(listPipelineFlowRuns).mockResolvedValue([
      { id: "run-1" },
      { id: "run-2" },
    ] as never);
    vi.mocked(executePipelineUntilPause)
      .mockResolvedValueOnce({
        runId: "run-1",
        steps: [{ claim: { stageId: "stage-1" }, status: "queued" }],
        run: { status: "queued" },
        budgetExhausted: false,
      } as never)
      .mockResolvedValueOnce({
        runId: "run-2",
        steps: [{ claim: null, status: "queued" }],
        run: { status: "queued" },
        budgetExhausted: false,
      } as never);

    const response = await GET(
      new Request("http://localhost/api/internal/pipeline-operations/run", {
        headers: { Authorization: "Bearer cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      recovered: 2,
      recoveredPublications: 1,
      continued: 1,
      enqueued: 0,
    });
    expect(executePipelineUntilPause).toHaveBeenCalledTimes(2);
    expect(createPipelineFlowRun).not.toHaveBeenCalled();
  });

  it("fans out Tier 2 schedules with profile-specific inputs and idempotency", async () => {
    const profileOne = "91000000-0000-4000-8000-000000000001";
    const profileTwo = "91000000-0000-4000-8000-000000000002";
    vi.mocked(getDuePipelineSchedules).mockResolvedValue([
      {
        definitionKey: "tier2-partner",
        sourceProfileId: profileOne,
        intervalMinutes: 1440,
        canaryExactInputs: { profileId: profileOne },
      },
      {
        definitionKey: "tier2-partner",
        sourceProfileId: profileTwo,
        intervalMinutes: 1440,
        canaryExactInputs: { profileId: profileTwo },
      },
    ]);
    vi.mocked(createPipelineFlowRun)
      .mockResolvedValueOnce({ created: true, run: { id: "run-1" } } as never)
      .mockResolvedValueOnce({ created: true, run: { id: "run-2" } } as never);
    vi.mocked(executePipelineUntilPause).mockResolvedValue({
      steps: [{ claim: { stageId: "stage-1" }, status: "queued" }],
      run: { status: "queued" },
      budgetExhausted: false,
    } as never);

    const response = await GET(
      new Request("http://localhost/api/internal/pipeline-operations/run", {
        headers: { Authorization: "Bearer cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      enqueued: 2,
      continued: 2,
    });
    expect(createPipelineFlowRun).toHaveBeenCalledTimes(2);
    expect(createPipelineFlowRun).toHaveBeenNthCalledWith(1, expect.objectContaining({
      exactInputs: { capturedAt: "now", profileId: profileOne },
      idempotencyKey: expect.stringContaining(`schedule:tier2-partner:${profileOne}:`),
    }));
    expect(createPipelineFlowRun).toHaveBeenNthCalledWith(2, expect.objectContaining({
      exactInputs: { capturedAt: "now", profileId: profileTwo },
      idempotencyKey: expect.stringContaining(`schedule:tier2-partner:${profileTwo}:`),
    }));
    expect(markPipelineScheduleEnqueued).toHaveBeenNthCalledWith(
      1,
      "tier2-partner",
      profileOne,
    );
    expect(markPipelineScheduleEnqueued).toHaveBeenNthCalledWith(
      2,
      "tier2-partner",
      profileTwo,
    );
    expect(executePipelineUntilPause).toHaveBeenCalledTimes(2);
  });

  it("revalidates profile activity immediately before creating a scheduled run", async () => {
    const profileId = "91000000-0000-4000-8000-000000000001";
    vi.mocked(getDuePipelineSchedules).mockResolvedValue([
      {
        definitionKey: "tier2-partner",
        sourceProfileId: profileId,
        intervalMinutes: 1440,
        canaryExactInputs: { profileId },
      },
    ]);
    vi.mocked(isPipelineScheduleSourceProfileActive).mockResolvedValue(false);

    const response = await GET(
      new Request("http://localhost/api/internal/pipeline-operations/run", {
        headers: { Authorization: "Bearer cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(createPipelineFlowRun).not.toHaveBeenCalled();
    expect(markPipelineScheduleEnqueued).not.toHaveBeenCalled();
  });

  it("does not enqueue a run when too little invocation budget remains to start it", async () => {
    vi.mocked(newPipelineContinuationDeadline).mockReturnValue(0);
    vi.mocked(getDuePipelineSchedules).mockResolvedValue([
      {
        definitionKey: "source-imb-people-groups",
        sourceProfileId: null,
        intervalMinutes: 1440,
        canaryExactInputs: {},
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/internal/pipeline-operations/run", {
        headers: { Authorization: "Bearer cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ enqueued: 0 });
    expect(createPipelineFlowRun).not.toHaveBeenCalled();
    expect(markPipelineScheduleEnqueued).not.toHaveBeenCalled();
  });

  it("does not enqueue after the source configuration drifts from its manual canary", async () => {
    vi.mocked(getDuePipelineSchedules).mockResolvedValue([{
      definitionKey: "source-imb-people-groups",
      sourceProfileId: null,
      intervalMinutes: 1440,
      canaryExactInputs: { sourceExecutionBindings: { old: true } },
    }]);
    vi.mocked(pipelineSourceCanaryMatchesCurrent).mockReturnValue(false);

    const response = await GET(
      new Request("http://localhost/api/internal/pipeline-operations/run", {
        headers: { Authorization: "Bearer cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(createPipelineFlowRun).not.toHaveBeenCalled();
    expect(markPipelineScheduleEnqueued).not.toHaveBeenCalled();
  });
});
