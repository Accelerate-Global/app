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
    vi.mocked(getAxIdentityRegistryOverview).mockResolvedValue({ bindings: [], revisions: [], runs: [] });
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ bindings: [], revisions: [], runs: [] });
  });
});
