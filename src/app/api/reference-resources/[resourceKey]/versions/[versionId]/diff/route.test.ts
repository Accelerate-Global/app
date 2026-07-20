import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { getReferenceResourceDiff } from "@/lib/reference-resources";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/error-logging", () => ({ logError: vi.fn() }));
vi.mock("@/lib/reference-resources", async (original) => ({ ...(await original<typeof import("@/lib/reference-resources")>()), getReferenceResourceDiff: vi.fn() }));

describe("reference resource diff route", () => {
  beforeEach(() => vi.resetAllMocks());
  it("returns the private detailed diff to admins", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue({ ownerId: "admin-1", email: null, fullName: null, workspaceRole: "admin", isDatasetAdmin: true, mode: "supabase" });
    vi.mocked(getReferenceResourceDiff).mockResolvedValue({ summary: { changed: 1 } });
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ resourceKey: "country-territory-codes", versionId: "version-2" }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ diff: { summary: { changed: 1 } } });
  });
});
