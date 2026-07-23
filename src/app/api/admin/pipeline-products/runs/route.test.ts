import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { buildPipelineProduct, listPipelineRuns } from "@/lib/pipeline-products";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/pipeline-products", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pipeline-products")>("@/lib/pipeline-products");
  return { ...actual, buildPipelineProduct: vi.fn(), listPipelineRuns: vi.fn() };
});

const identity = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Admin",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

describe("/api/admin/pipeline-products/runs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue(identity);
    vi.mocked(listPipelineRuns).mockResolvedValue([]);
  });

  it("rejects a build from a non-admin", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue({ ...identity, isDatasetAdmin: false });
    const response = await POST(new Request("http://localhost/api/admin/pipeline-products/runs", {
      method: "POST",
      body: JSON.stringify({
        definitionKey: "tier1-pgic-merge",
        releaseSetId: "11111111-1111-4111-8111-111111111111",
      }),
    }));
    expect(response.status).toBe(403);
    expect(buildPipelineProduct).not.toHaveBeenCalled();
  });

  it("rejects malformed candidate input before calling the build service", async () => {
    const response = await POST(new Request("http://localhost/api/admin/pipeline-products/runs", {
      method: "POST",
      body: JSON.stringify({ definitionKey: "" }),
    }));
    expect(response.status).toBe(400);
    expect(buildPipelineProduct).not.toHaveBeenCalled();
  });
});
