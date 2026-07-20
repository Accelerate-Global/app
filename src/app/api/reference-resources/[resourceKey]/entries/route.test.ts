import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { getReferenceResourcePage, ReferenceResourceValidationError } from "@/lib/reference-resources";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/error-logging", () => ({ logError: vi.fn() }));
vi.mock("@/lib/reference-resources", async (original) => ({
  ...(await original<typeof import("@/lib/reference-resources")>()),
  getReferenceResourcePage: vi.fn(),
}));

const user = { ownerId: "owner-1", email: "reader@example.com", fullName: null, workspaceRole: "basic" as const, isDatasetAdmin: false, mode: "supabase" as const };
const context = { params: Promise.resolve({ resourceKey: "country-territory-codes" }) };

describe("reference resource entries route", () => {
  beforeEach(() => vi.resetAllMocks());

  it("validates resource keys and protects inactive versions", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue(user);
    expect((await GET(new Request("http://localhost/api/reference-resources/nope/entries"), { params: Promise.resolve({ resourceKey: "nope" }) })).status).toBe(404);
    expect((await GET(new Request("http://localhost/api/reference-resources/country-territory-codes/entries?versionId=10000000-0000-4000-8000-000000000001"), context)).status).toBe(403);
  });

  it("passes bounded query inputs and maps invalid cursors", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue(user);
    vi.mocked(getReferenceResourcePage).mockResolvedValue({ entries: [], nextCursor: null } as never);
    const response = await GET(new Request("http://localhost/api/reference-resources/country-territory-codes/entries?search=AFG&limit=25"), context);
    expect(response.status).toBe(200);
    expect(getReferenceResourcePage).toHaveBeenCalledWith(expect.objectContaining({ search: "AFG", limit: 25 }));

    vi.mocked(getReferenceResourcePage).mockRejectedValue(new ReferenceResourceValidationError("cursor invalid"));
    expect((await GET(new Request("http://localhost/api/reference-resources/country-territory-codes/entries?cursor=bad"), context)).status).toBe(400);
  });
});
