import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { listReferenceResourceActivationHistory, listReferenceResourceVersions } from "@/lib/reference-resources";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/error-logging", () => ({ logError: vi.fn() }));
vi.mock("@/lib/reference-resources", () => ({ listReferenceResourceVersions: vi.fn(), listReferenceResourceActivationHistory: vi.fn() }));

describe("reference resource history route", () => {
  beforeEach(() => vi.resetAllMocks());
  it("is admin-only and returns immutable version plus activation history", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue({ ownerId: "admin-1", email: null, fullName: null, workspaceRole: "admin", isDatasetAdmin: true, mode: "supabase" });
    vi.mocked(listReferenceResourceVersions).mockResolvedValue([]);
    vi.mocked(listReferenceResourceActivationHistory).mockResolvedValue([]);
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ resourceKey: "rop-codes" }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ versions: [], activationHistory: [] });
  });
});
