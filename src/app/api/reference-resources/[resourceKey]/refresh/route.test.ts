import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { refreshReferenceResourceCandidate } from "@/lib/reference-resources/refresh";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));
vi.mock("@/lib/error-logging", () => ({ logError: vi.fn() }));
vi.mock("@/lib/reference-resources/refresh", () => ({ refreshReferenceResourceCandidate: vi.fn() }));

describe("reference resource refresh route", () => {
  beforeEach(() => vi.resetAllMocks());

  it("requires admin and creates a persisted candidate", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue({ ownerId: "owner-1", email: null, fullName: null, workspaceRole: "basic", isDatasetAdmin: false, mode: "supabase" });
    expect((await POST(new Request("http://localhost"), { params: Promise.resolve({ resourceKey: "rop-codes" }) })).status).toBe(403);

    vi.mocked(getCurrentIdentity).mockResolvedValue({ ownerId: "admin-1", email: null, fullName: null, workspaceRole: "admin", isDatasetAdmin: true, mode: "supabase" });
    vi.mocked(refreshReferenceResourceCandidate).mockResolvedValue({ unchanged: true } as never);
    const response = await POST(new Request("http://localhost"), { params: Promise.resolve({ resourceKey: "rop-codes" }) });
    expect(response.status).toBe(200);
    expect(refreshReferenceResourceCandidate).toHaveBeenCalledWith({ resourceKey: "rop-codes", actorOwnerId: "admin-1" });
  });
});
