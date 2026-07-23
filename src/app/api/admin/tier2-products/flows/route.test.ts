import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/error-logging", () => ({ logError: vi.fn() }));
vi.mock("@/lib/pipeline-operations", () => ({
  createPipelineFlowRun: vi.fn(),
  executePipelineUntilPause: vi.fn(),
  getPipelineFlowDefinition: vi.fn(() => ({ key: "tier2-partner" })),
  registeredPipelineStageHandlers: {},
  snapshotCurrentPipelineInputs: vi.fn(),
}));

import { getCurrentIdentity } from "@/lib/auth";
import {
  createPipelineFlowRun,
  snapshotCurrentPipelineInputs,
} from "@/lib/pipeline-operations";

import { POST } from "./route";

const admin = {
  ownerId: "admin",
  email: "admin@example.test",
  fullName: null,
  workspaceRole: "admin",
  isDatasetAdmin: true,
  mode: "supabase",
} as const;

describe("Tier 2 profile-specific flow launch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue(admin);
    vi.mocked(snapshotCurrentPipelineInputs).mockResolvedValue({
      resourceSetId: "resource-set",
      tier2ProfileBindings: {
        alpha: {
          id: "10000000-0000-4000-8000-000000000001",
          connectionId: "connection-alpha",
        },
        beta: {
          id: "10000000-0000-4000-8000-000000000002",
          connectionId: "connection-beta",
        },
      },
    });
    vi.mocked(createPipelineFlowRun).mockResolvedValue({
      created: true,
      run: { id: "flow-run" },
    } as never);
  });

  it("pins the selected active profile without losing the rest of the snapshot", async () => {
    const response = await POST(new Request("http://test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: "10000000-0000-4000-8000-000000000002",
        requestId: "20000000-0000-4000-8000-000000000001",
      }),
    }));
    expect(response.status).toBe(202);
    expect(createPipelineFlowRun).toHaveBeenCalledWith(expect.objectContaining({
      exactInputs: expect.objectContaining({
        profileId: "10000000-0000-4000-8000-000000000002",
        resourceSetId: "resource-set",
      }),
    }));
  });

  it("rejects a profile that is absent from the exact current snapshot", async () => {
    const response = await POST(new Request("http://test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: "10000000-0000-4000-8000-000000000099",
        requestId: "20000000-0000-4000-8000-000000000001",
      }),
    }));
    expect(response.status).toBe(409);
    expect(createPipelineFlowRun).not.toHaveBeenCalled();
  });
});
