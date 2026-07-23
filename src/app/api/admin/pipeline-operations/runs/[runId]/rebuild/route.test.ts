import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/pipeline-operations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pipeline-operations")>(
    "@/lib/pipeline-operations",
  );
  return {
    ...actual,
    createPipelineFlowRun: vi.fn(),
    executePipelineUntilPause: vi.fn(),
    getPipelineFlowDefinition: vi.fn(),
    getPipelineFlowRun: vi.fn(),
    snapshotCurrentPipelineInputs: vi.fn(),
  };
});

import { getCurrentIdentity } from "@/lib/auth";
import {
  createPipelineFlowRun,
  getPipelineFlowDefinition,
  getPipelineFlowRun,
  snapshotCurrentPipelineInputs,
} from "@/lib/pipeline-operations";

import { POST } from "./route";

const profileId = "10000000-0000-4000-8000-000000000001";
const requestId = "20000000-0000-4000-8000-000000000001";
const runId = "30000000-0000-4000-8000-000000000001";

describe("pipeline rebuild scoping", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue({
      ownerId: "admin-1",
      email: "admin@example.test",
      fullName: null,
      workspaceRole: "admin",
      isDatasetAdmin: true,
      mode: "supabase",
    });
    vi.mocked(getPipelineFlowDefinition).mockReturnValue({
      key: "tier2-partner",
    } as never);
    vi.mocked(getPipelineFlowRun).mockResolvedValue({
      id: runId,
      definitionKey: "tier2-partner",
      exactInputs: { profileId },
    } as never);
    vi.mocked(snapshotCurrentPipelineInputs).mockResolvedValue({
      resourceSetId: "40000000-0000-4000-8000-000000000001",
      tier2ProfileBindings: {
        partner: { id: profileId, connectionId: "connection-1" },
      },
    });
    vi.mocked(createPipelineFlowRun).mockResolvedValue({
      created: true,
      run: { id: "50000000-0000-4000-8000-000000000001" },
    } as never);
  });

  it("keeps the original exact Tier 2 profile on rebuild", async () => {
    const response = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      }),
      { params: Promise.resolve({ runId }) },
    );

    expect(response.status).toBe(202);
    expect(createPipelineFlowRun).toHaveBeenCalledWith(
      expect.objectContaining({
        launchKind: "rebuild",
        exactInputs: expect.objectContaining({ profileId }),
      }),
    );
  });

  it("refuses to rebuild when the original profile is no longer active", async () => {
    vi.mocked(snapshotCurrentPipelineInputs).mockResolvedValue({
      tier2ProfileBindings: {},
    });
    const response = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      }),
      { params: Promise.resolve({ runId }) },
    );

    expect(response.status).toBe(409);
    expect(createPipelineFlowRun).not.toHaveBeenCalled();
  });

  it("rejects client-supplied exact inputs before rebuilding", async () => {
    const response = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          exactInputs: { resourceSetId: "client-controlled" },
        }),
      }),
      { params: Promise.resolve({ runId }) },
    );

    expect(response.status).toBe(400);
    expect(getPipelineFlowRun).not.toHaveBeenCalled();
    expect(snapshotCurrentPipelineInputs).not.toHaveBeenCalled();
    expect(createPipelineFlowRun).not.toHaveBeenCalled();
  });
});
