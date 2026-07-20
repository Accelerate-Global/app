import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { listReferenceResourceFindings } from "@/lib/reference-resources";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/error-logging", () => ({ logError: vi.fn() }));
vi.mock("@/lib/reference-resources", async (original) => ({ ...(await original<typeof import("@/lib/reference-resources")>()), listReferenceResourceFindings: vi.fn() }));

describe("reference resource findings route", () => {
  beforeEach(() => vi.resetAllMocks());
  it("returns findings only to admins for a resource-scoped version", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue({ ownerId: "admin-1", email: null, fullName: null, workspaceRole: "admin", isDatasetAdmin: true, mode: "supabase" });
    vi.mocked(listReferenceResourceFindings).mockResolvedValue([]);
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ resourceKey: "rop-codes", versionId: "version-1" }) });
    expect(response.status).toBe(200);
    expect(listReferenceResourceFindings).toHaveBeenCalledWith({ resourceKey: "rop-codes", versionId: "version-1" });
  });
});
