import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { finalizePipelineReleaseSet } from "@/lib/pipeline-products";

import { POST } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/pipeline-products", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pipeline-products")>(
    "@/lib/pipeline-products",
  );
  return { ...actual, finalizePipelineReleaseSet: vi.fn() };
});

const identity = {
  ownerId: "admin-1",
  email: "admin@example.test",
  fullName: "Admin",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

describe("/api/admin/pipeline-products/releases", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue(identity);
  });

  it("uses the complete compatibility finalizer for the direct admin API", async () => {
    vi.mocked(finalizePipelineReleaseSet).mockResolvedValue({
      id: "10000000-0000-4000-8000-000000000001",
      status: "finalized",
    } as never);
    const members = ["ax", "etno", "imb", "jp", "wcd"].map(
      (inputKey, index) => ({
        inputKey,
        publicationId:
          `10000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
        expectedChecksum: String(index + 1).repeat(64),
      }),
    );
    const payload = {
      releaseKey: "tier1-direct-release",
      resourceSetId: "10000000-0000-4000-8000-000000000002",
      registryRevisionId: "10000000-0000-4000-8000-000000000003",
      ruleVersion: "v1",
      ruleChecksum: "f".repeat(64),
      priorities: [{
        canonicalField: "PG_Name",
        prioritySourceKeys: ["jp", "imb"],
      }],
      members,
      reason: "Reviewed direct release",
    };

    const response = await POST(new Request(
      "http://localhost/api/admin/pipeline-products/releases",
      { method: "POST", body: JSON.stringify(payload) },
    ));

    expect(response.status).toBe(201);
    expect(finalizePipelineReleaseSet).toHaveBeenCalledWith({
      ...payload,
      actorOwnerId: identity.ownerId,
      actorEmail: identity.email,
    });
  });
});
