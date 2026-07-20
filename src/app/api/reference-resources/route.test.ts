import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { listReferenceResourceCatalog } from "@/lib/reference-resources";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/reference-resources", () => ({ listReferenceResourceCatalog: vi.fn() }));
vi.mock("@/lib/error-logging", () => ({ logError: vi.fn() }));

const identity = { ownerId: "owner-1", email: "admin@example.com", fullName: null, workspaceRole: "admin" as const, isDatasetAdmin: true, mode: "supabase" as const };

describe("/api/reference-resources", () => {
  beforeEach(() => vi.resetAllMocks());

  it("guards authentication and filters admin catalog state by role", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue(null);
    expect((await GET()).status).toBe(401);

    vi.mocked(getCurrentIdentity).mockResolvedValue(identity);
    vi.mocked(listReferenceResourceCatalog).mockResolvedValue([]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(listReferenceResourceCatalog).toHaveBeenCalledWith({ includeAdminState: true });
    await expect(response.json()).resolves.toEqual({ resources: [] });
  });
});
