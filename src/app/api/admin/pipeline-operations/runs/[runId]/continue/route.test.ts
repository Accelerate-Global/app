import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  executePipelineUntilPause,
  getPipelineFlowRun,
} from "@/lib/pipeline-operations";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({ after: vi.fn() }));

vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/pipeline-operations", () => ({
  executePipelineUntilPause: vi.fn(),
  getPipelineFlowRun: vi.fn(),
}));
vi.mock("@/lib/route-guard", () => ({
  withRoute:
    (
      _options: unknown,
      handler: (identity: unknown, request: Request, context: unknown) => unknown,
    ) =>
    (request: Request, context: unknown) =>
      handler({ ownerId: "admin-1" }, request, context),
}));

const context = { params: Promise.resolve({ runId: "run-1" }) };

describe("pipeline continuation route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(executePipelineUntilPause).mockResolvedValue({} as never);
  });

  it("accepts a queued run and executes its bounded continuation", async () => {
    vi.mocked(getPipelineFlowRun).mockResolvedValue({
      id: "run-1",
      status: "queued",
    } as never);

    const response = await POST(
      new Request("http://localhost/api/admin/pipeline-operations/runs/run-1/continue", {
        method: "POST",
      }),
      context,
    );

    expect(response.status).toBe(202);
    const callback = mocks.after.mock.calls[0]?.[0] as
      | (() => Promise<void>)
      | undefined;
    expect(callback).toBeTypeOf("function");
    await callback?.();
    expect(executePipelineUntilPause).toHaveBeenCalledWith({ runId: "run-1" });
  });

  it("rejects a run that is waiting for review", async () => {
    vi.mocked(getPipelineFlowRun).mockResolvedValue({
      id: "run-1",
      status: "awaiting_review",
    } as never);
    const response = await POST(
      new Request("http://localhost/api/admin/pipeline-operations/runs/run-1/continue", {
        method: "POST",
      }),
      context,
    );
    expect(response.status).toBe(409);
    expect(mocks.after).not.toHaveBeenCalled();
  });
});
