import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import {
  createPipelineFlowRun,
  listPipelineFlowRuns,
  PipelineOperationError,
  snapshotCurrentPipelineInputs,
} from "@/lib/pipeline-operations";

import { GET, POST } from "./route";

vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/error-logging", () => ({ logError: vi.fn() }));
vi.mock("@/lib/pipeline-operations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pipeline-operations")>(
    "@/lib/pipeline-operations",
  );
  return {
    ...actual,
    createPipelineFlowRun: vi.fn(),
    executePipelineUntilPause: vi.fn(),
    listPipelineFlowRuns: vi.fn(),
    snapshotCurrentPipelineInputs: vi.fn(),
  };
});

const identity = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Admin",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

const requestId = "00000000-0000-4000-8000-000000000001";

describe("/api/admin/pipeline-operations/runs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue(identity);
    vi.mocked(listPipelineFlowRuns).mockResolvedValue([]);
    vi.mocked(snapshotCurrentPipelineInputs).mockResolvedValue({
      connectionIds: {},
    });
  });

  it("rejects invalid status filters without querying storage", async () => {
    const response = await GET(
      new Request("http://localhost/api/admin/pipeline-operations/runs?status=secret"),
    );
    expect(response.status).toBe(400);
    expect(listPipelineFlowRuns).not.toHaveBeenCalled();
  });

  it("rejects non-admin launches", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue({
      ...identity,
      isDatasetAdmin: false,
    });
    const response = await POST(
      new Request("http://localhost/api/admin/pipeline-operations/runs", {
        method: "POST",
        body: JSON.stringify({
          definitionKey: "source-imb-people-groups",
          launchKind: "manual",
          requestId,
        }),
      }),
    );
    expect(response.status).toBe(403);
    expect(createPipelineFlowRun).not.toHaveBeenCalled();
  });

  it("derives every normal launch snapshot on the server", async () => {
    vi.mocked(createPipelineFlowRun).mockResolvedValue({
      created: false,
      run: { id: "run-1" },
    } as never);
    const response = await POST(
      new Request("http://localhost/api/admin/pipeline-operations/runs", {
        method: "POST",
        body: JSON.stringify({
          definitionKey: "source-imb-people-groups",
          launchKind: "manual",
          requestId,
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(snapshotCurrentPipelineInputs).toHaveBeenCalledOnce();
    expect(createPipelineFlowRun).toHaveBeenCalledWith(
      expect.objectContaining({
        launchKind: "manual",
        exactInputs: { connectionIds: {} },
      }),
    );
  });

  it("rejects client-supplied exact inputs on a normal launch", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/pipeline-operations/runs", {
        method: "POST",
        body: JSON.stringify({
          definitionKey: "source-imb-people-groups",
          launchKind: "manual",
          requestId,
          exactInputs: { resourceSetId: "client-controlled" },
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(snapshotCurrentPipelineInputs).not.toHaveBeenCalled();
    expect(createPipelineFlowRun).not.toHaveBeenCalled();
  });

  it("rejects backfill launches outside the dedicated historical endpoint", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/pipeline-operations/runs", {
        method: "POST",
        body: JSON.stringify({
          definitionKey: "source-imb-people-groups",
          launchKind: "backfill",
          requestId,
          exactInputs: {
            resourceSetId: "10000000-0000-4000-8000-000000000001",
          },
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(snapshotCurrentPipelineInputs).not.toHaveBeenCalled();
    expect(createPipelineFlowRun).not.toHaveBeenCalled();
  });

  it("returns a controlled domain error", async () => {
    vi.mocked(createPipelineFlowRun).mockRejectedValue(
      new PipelineOperationError("Exact input is unavailable.", 409, "input-missing"),
    );
    const response = await POST(
      new Request("http://localhost/api/admin/pipeline-operations/runs", {
        method: "POST",
        body: JSON.stringify({
          definitionKey: "source-imb-people-groups",
          launchKind: "manual",
          requestId,
        }),
      }),
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "Exact input is unavailable." });
  });

  it("does not expose raw database or provider errors", async () => {
    vi.mocked(createPipelineFlowRun).mockRejectedValue(
      new Error("postgres password=secret provider-token=private"),
    );
    const response = await POST(
      new Request("http://localhost/api/admin/pipeline-operations/runs", {
        method: "POST",
        body: JSON.stringify({
          definitionKey: "source-imb-people-groups",
          launchKind: "manual",
          requestId,
        }),
      }),
    );
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).toContain("Could not launch the pipeline.");
    expect(body).not.toContain("secret");
    expect(body).not.toContain("provider-token");
  });
});
