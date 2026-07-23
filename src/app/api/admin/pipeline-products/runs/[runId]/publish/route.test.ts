import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { publishPipelineRun } from "@/lib/pipeline-products";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/pipeline-products", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pipeline-products")>("@/lib/pipeline-products");
  return { ...actual, publishPipelineRun: vi.fn() };
});

const identity = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Admin",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

const context = {
  params: Promise.resolve({ runId: "85000000-0000-4000-8000-000000000030" }),
};

describe("/api/admin/pipeline-products/runs/:runId/publish", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue(identity);
    vi.mocked(publishPipelineRun).mockResolvedValue(null);
  });

  it("rejects publication without the target state pinned by the reviewed candidate", async () => {
    const response = await POST(new Request("http://localhost/api/admin/pipeline-products/runs/run/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Reviewed", acknowledgeWarnings: false }),
    }), context);
    expect(response.status).toBe(400);
    expect(publishPipelineRun).not.toHaveBeenCalled();
  });

  it("passes the expected current publication through to the atomic publish service", async () => {
    const response = await POST(new Request("http://localhost/api/admin/pipeline-products/runs/run/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: "Reviewed",
        acknowledgeWarnings: true,
        expectedCurrentPublicationId: "85000000-0000-4000-8000-000000000040",
      }),
    }), context);
    expect(response.status).toBe(200);
    expect(publishPipelineRun).toHaveBeenCalledWith(expect.objectContaining({
      expectedCurrentPublicationId: "85000000-0000-4000-8000-000000000040",
    }));
  });
});
