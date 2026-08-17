import { beforeEach, describe, expect, it, vi } from "vitest";

import { getApiConnectionRunDetail } from "@/lib/api-connections";
import { cancelApiConnectionRun } from "@/lib/api-connections/durable-joshua";
import { getCurrentIdentity } from "@/lib/auth";
import { POST } from "./route";

const { cancelWorkflowMock } = vi.hoisted(() => ({
  cancelWorkflowMock: vi.fn(),
}));

vi.mock("workflow/api", () => ({
  getRun: vi.fn(() => ({ cancel: cancelWorkflowMock })),
}));
vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/api-connections", () => ({ getApiConnectionRunDetail: vi.fn() }));
vi.mock("@/lib/api-connections/durable-joshua", () => ({
  cancelApiConnectionRun: vi.fn(),
}));

const identity = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Admin",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};
const run = {
  id: "22222222-2222-4222-8222-222222222222",
  connectionId: "11111111-1111-4111-8111-111111111111",
  status: "cancelled" as const,
  workflowRunId: "wrun_test",
};
const context = {
  params: Promise.resolve({ connectionId: run.connectionId, runId: run.id }),
};

describe("cancel API connection run", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue(identity);
  });

  it("rejects a non-admin without changing run or workflow state", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue({
      ...identity,
      isDatasetAdmin: false,
    });

    const response = await POST(
      new Request("http://localhost", { method: "POST" }),
      context,
    );

    expect(response.status).toBe(403);
    expect(cancelApiConnectionRun).not.toHaveBeenCalled();
    expect(cancelWorkflowMock).not.toHaveBeenCalled();
  });

  it("records cancellation before cancelling the durable runtime", async () => {
    vi.mocked(cancelApiConnectionRun).mockResolvedValue(run as never);
    vi.mocked(getApiConnectionRunDetail).mockResolvedValue(run as never);

    const response = await POST(
      new Request("http://localhost", { method: "POST" }),
      context,
    );

    expect(response.status).toBe(200);
    expect(cancelApiConnectionRun).toHaveBeenCalledWith({
      connectionId: run.connectionId,
      runId: run.id,
    });
    expect(cancelWorkflowMock).toHaveBeenCalledOnce();
  });

  it("rejects cancellation of a terminal run", async () => {
    vi.mocked(cancelApiConnectionRun).mockResolvedValue(null as never);
    vi.mocked(getApiConnectionRunDetail).mockResolvedValue(run as never);

    const response = await POST(
      new Request("http://localhost", { method: "POST" }),
      context,
    );

    expect(response.status).toBe(409);
    expect(cancelWorkflowMock).not.toHaveBeenCalled();
  });
});
