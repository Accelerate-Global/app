import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getActiveWorkspaceAdminCount,
  getActiveWorkspaceSuperAdminCount,
  listWorkspaceUsers,
  setWorkspaceUserDisabled,
} from "@/lib/user-management";
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

vi.mock("@/lib/user-management", async () => {
  const actual = await vi.importActual<typeof import("@/lib/user-management")>(
    "@/lib/user-management",
  );

  return {
    ...actual,
    getActiveWorkspaceAdminCount: vi.fn(),
    getActiveWorkspaceSuperAdminCount: vi.fn(),
    listWorkspaceUsers: vi.fn(),
    setWorkspaceUserDisabled: vi.fn(),
  };
});

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const createSupabaseAdminClientMock = vi.mocked(createSupabaseAdminClient);
const hasSupabaseConfigMock = vi.mocked(hasSupabaseConfig);
const createSupabaseServerClientMock = vi.mocked(createSupabaseServerClient);
const getActiveWorkspaceAdminCountMock = vi.mocked(getActiveWorkspaceAdminCount);
const getActiveWorkspaceSuperAdminCountMock = vi.mocked(
  getActiveWorkspaceSuperAdminCount,
);
const listWorkspaceUsersMock = vi.mocked(listWorkspaceUsers);
const setWorkspaceUserDisabledMock = vi.mocked(setWorkspaceUserDisabled);

const identity = {
  ownerId: "supabase-user",
  email: "admin@example.com",
  fullName: "Blake",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

describe("/api/account/disable", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    hasSupabaseConfigMock.mockReturnValue(true);
    getCurrentIdentityMock.mockResolvedValue(identity);
    listWorkspaceUsersMock.mockResolvedValue([
      {
        id: "supabase-user",
        email: "admin@example.com",
        fullName: "Blake",
        workspaceRole: "admin",
        accountStatus: "active",
        providers: ["email"],
        identities: [],
        createdAt: "2026-04-15T20:00:00.000Z",
        updatedAt: "2026-04-15T20:00:00.000Z",
        invitedAt: null,
        confirmedAt: "2026-04-15T20:00:00.000Z",
        emailConfirmedAt: "2026-04-15T20:00:00.000Z",
        lastLoginAt: "2026-04-15T20:00:00.000Z",
        bannedUntil: null,
      },
      {
        id: "admin-2",
        email: "admin2@example.com",
        fullName: "Admin Two",
        workspaceRole: "admin",
        accountStatus: "active",
        providers: ["email"],
        identities: [],
        createdAt: "2026-04-15T20:00:00.000Z",
        updatedAt: "2026-04-15T20:00:00.000Z",
        invitedAt: null,
        confirmedAt: "2026-04-15T20:00:00.000Z",
        emailConfirmedAt: "2026-04-15T20:00:00.000Z",
        lastLoginAt: "2026-04-15T20:00:00.000Z",
        bannedUntil: null,
      },
    ]);
    getActiveWorkspaceAdminCountMock.mockReturnValue(2);
    getActiveWorkspaceSuperAdminCountMock.mockReturnValue(1);
    setWorkspaceUserDisabledMock.mockResolvedValue({
      id: "supabase-user",
      email: "admin@example.com",
      fullName: "Blake",
      workspaceRole: "admin",
      accountStatus: "disabled",
      providers: ["email"],
      identities: [],
      createdAt: "2026-04-15T20:00:00.000Z",
      updatedAt: "2026-04-15T20:00:00.000Z",
      invitedAt: null,
      confirmedAt: "2026-04-15T20:00:00.000Z",
      emailConfirmedAt: "2026-04-15T20:00:00.000Z",
      lastLoginAt: "2026-04-15T20:00:00.000Z",
      bannedUntil: "3026-04-15T20:00:00.000Z",
    });
  });

  it("rejects unauthenticated requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await POST();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
  });

  it("disables the current account and signs the user out", async () => {
    const revokeSessions = vi.fn().mockResolvedValue({ error: null });
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const getSession = vi.fn().mockResolvedValue({
      data: { session: { access_token: "session-token" } },
    });

    getCurrentIdentityMock.mockResolvedValue(identity);
    createSupabaseAdminClientMock.mockReturnValue({
      auth: { admin: { signOut: revokeSessions } },
    } as never);
    createSupabaseServerClientMock.mockResolvedValue({
      auth: { getSession, signOut },
    } as never);

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(setWorkspaceUserDisabledMock).toHaveBeenCalledWith("supabase-user", true);
    expect(revokeSessions).toHaveBeenCalledWith("session-token", "global");
    expect(signOut).toHaveBeenCalled();
  });

  it("rejects self-disable for the last active admin", async () => {
    getActiveWorkspaceAdminCountMock.mockReturnValue(1);
    listWorkspaceUsersMock.mockResolvedValue([
      {
        id: "supabase-user",
        email: "admin@example.com",
        fullName: "Blake",
        workspaceRole: "admin",
        accountStatus: "active",
        providers: ["email"],
        identities: [],
        createdAt: "2026-04-15T20:00:00.000Z",
        updatedAt: "2026-04-15T20:00:00.000Z",
        invitedAt: null,
        confirmedAt: "2026-04-15T20:00:00.000Z",
        emailConfirmedAt: "2026-04-15T20:00:00.000Z",
        lastLoginAt: "2026-04-15T20:00:00.000Z",
        bannedUntil: null,
      },
    ]);

    const response = await POST();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "The last active admin-capable account cannot disable their own account.",
    });
    expect(setWorkspaceUserDisabledMock).not.toHaveBeenCalled();
  });

  it("rejects self-disable for the last active super admin", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      workspaceRole: "super_admin",
    });
    getActiveWorkspaceAdminCountMock.mockReturnValue(2);
    getActiveWorkspaceSuperAdminCountMock.mockReturnValue(1);
    listWorkspaceUsersMock.mockResolvedValue([
      {
        id: "supabase-user",
        email: "admin@example.com",
        fullName: "Blake",
        workspaceRole: "super_admin",
        accountStatus: "active",
        providers: ["email"],
        identities: [],
        createdAt: "2026-04-15T20:00:00.000Z",
        updatedAt: "2026-04-15T20:00:00.000Z",
        invitedAt: null,
        confirmedAt: "2026-04-15T20:00:00.000Z",
        emailConfirmedAt: "2026-04-15T20:00:00.000Z",
        lastLoginAt: "2026-04-15T20:00:00.000Z",
        bannedUntil: null,
      },
      {
        id: "admin-2",
        email: "admin2@example.com",
        fullName: "Admin Two",
        workspaceRole: "admin",
        accountStatus: "active",
        providers: ["email"],
        identities: [],
        createdAt: "2026-04-15T20:00:00.000Z",
        updatedAt: "2026-04-15T20:00:00.000Z",
        invitedAt: null,
        confirmedAt: "2026-04-15T20:00:00.000Z",
        emailConfirmedAt: "2026-04-15T20:00:00.000Z",
        lastLoginAt: "2026-04-15T20:00:00.000Z",
        bannedUntil: null,
      },
    ]);

    const response = await POST();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "The last active super admin cannot disable their own account.",
    });
    expect(setWorkspaceUserDisabledMock).not.toHaveBeenCalled();
  });

  it("rejects self-disable for basic users", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      workspaceRole: "basic",
      isDatasetAdmin: false,
    });

    const response = await POST();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Basic accounts cannot disable themselves.",
    });
    expect(listWorkspaceUsersMock).not.toHaveBeenCalled();
    expect(setWorkspaceUserDisabledMock).not.toHaveBeenCalled();
  });

  it("returns 503 when Supabase auth is unavailable", async () => {
    hasSupabaseConfigMock.mockReturnValue(false);

    const response = await POST();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Supabase is not configured for account management.",
    });
  });

  it("returns 500 when disabling the current account fails", async () => {
    const getSession = vi.fn().mockResolvedValue({
      data: { session: { access_token: "session-token" } },
    });

    createSupabaseAdminClientMock.mockReturnValue({
      auth: { admin: { signOut: vi.fn().mockResolvedValue({ error: null }) } },
    } as never);
    createSupabaseServerClientMock.mockResolvedValue({
      auth: { getSession, signOut: vi.fn().mockResolvedValue({ error: null }) },
    } as never);
    setWorkspaceUserDisabledMock.mockRejectedValue(new Error("disable failed"));

    const response = await POST();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Could not disable the current account.",
    });
  });
});
