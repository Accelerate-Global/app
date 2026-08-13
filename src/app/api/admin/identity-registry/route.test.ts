import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { getAxIdentityRegistryOverview } from "@/lib/identity-registry";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/identity-registry", () => ({ getAxIdentityRegistryOverview: vi.fn() }));

const identity = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Admin",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

const authority = {
  initialized: true,
  environment: "test",
  registryRevisionId: "revision-1",
  revisionNumber: 1,
  rulesChecksum: "a".repeat(64),
  formatterChecksum: "b".repeat(64),
  activatedAt: "2026-08-12T00:00:00.000Z",
};

describe("/api/admin/identity-registry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentIdentity).mockResolvedValue(identity);
  });

  it("is admin-only", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(getAxIdentityRegistryOverview).not.toHaveBeenCalled();
  });

  it("returns the complete registry overview", async () => {
    vi.mocked(getAxIdentityRegistryOverview).mockResolvedValue({ authority, bindings: [], revisions: [], runs: [] });
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ authority, bindings: [], revisions: [], runs: [] });
  });
});
