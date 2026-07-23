import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import {
  getPipelineProductSystemState,
  listEligibleIdentityPublications,
  listPipelineDefinitions,
  listPipelineProductPublications,
  listPipelineReleaseSets,
  listPipelineRuns,
} from "@/lib/pipeline-products";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/pipeline-products", () => ({
  getPipelineProductSystemState: vi.fn(),
  listEligibleIdentityPublications: vi.fn(),
  listPipelineDefinitions: vi.fn(),
  listPipelineProductPublications: vi.fn(),
  listPipelineReleaseSets: vi.fn(),
  listPipelineRuns: vi.fn(),
}));

const identity = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Admin",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

describe("/api/admin/pipeline-products", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue(identity);
    vi.mocked(getPipelineProductSystemState).mockResolvedValue({
      resourceSet: null,
      registryRevision: null,
      defaultRuleBinding: { version: "v1", checksum: "a".repeat(64), priorities: [] },
    });
    vi.mocked(listEligibleIdentityPublications).mockResolvedValue([]);
    vi.mocked(listPipelineReleaseSets).mockResolvedValue([]);
    vi.mocked(listPipelineProductPublications).mockResolvedValue([]);
    vi.mocked(listPipelineRuns).mockResolvedValue([]);
    vi.mocked(listPipelineDefinitions).mockReturnValue([]);
  });

  it("guards pipeline operations from anonymous users", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(listPipelineRuns).not.toHaveBeenCalled();
  });

  it("returns only server-owned operational state to admins", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      definitions: [], eligibleIdentityPublications: [], releases: [], publications: [], runs: [],
    });
  });
});
