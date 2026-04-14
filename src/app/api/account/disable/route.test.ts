import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseConfig: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const createSupabaseAdminClientMock = vi.mocked(createSupabaseAdminClient);
const hasSupabaseConfigMock = vi.mocked(hasSupabaseConfig);
const createSupabaseServerClientMock = vi.mocked(createSupabaseServerClient);

const identity = {
  ownerId: "supabase-user",
  email: "admin@example.com",
  fullName: "Blake",
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

describe("/api/account/disable", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    hasSupabaseConfigMock.mockReturnValue(true);
  });

  it("rejects unauthenticated requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await POST();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("disables the current account and signs the user out", async () => {
    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    const revokeSessions = vi.fn().mockResolvedValue({ error: null });
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const getSession = vi.fn().mockResolvedValue({
      data: { session: { access_token: "session-token" } },
    });

    getCurrentIdentityMock.mockResolvedValue(identity);
    createSupabaseAdminClientMock.mockReturnValue({
      auth: { admin: { updateUserById, signOut: revokeSessions } },
    } as never);
    createSupabaseServerClientMock.mockResolvedValue({
      auth: { getSession, signOut },
    } as never);

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(updateUserById).toHaveBeenCalledWith("supabase-user", {
      ban_duration: "876000h",
    });
    expect(revokeSessions).toHaveBeenCalledWith("session-token", "global");
    expect(signOut).toHaveBeenCalled();
  });

  it("returns 503 when Supabase auth is unavailable", async () => {
    hasSupabaseConfigMock.mockReturnValue(false);

    const response = await POST();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Supabase is not configured for account management.",
    });
  });
});
