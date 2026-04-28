import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User as AuthUser } from "@supabase/supabase-js";

import { getDb } from "@/db";
import type { WorkspaceUser } from "@/lib/api-types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertWorkspaceUserMutationAllowed,
  assertWorkspaceUserPasswordResetAllowed,
  getActiveWorkspaceAdminCount,
  getWorkspaceUserAccountStatus,
  inviteWorkspaceUser,
  mapAuthUserToWorkspaceUser,
  mergeWorkspaceRoleIntoAppMetadata,
  WorkspaceUserActionError,
  WorkspaceUserPermissionError,
} from "@/lib/user-management";

const { executeMock, inviteUserByEmailMock, updateUserByIdMock } = vi.hoisted(() => ({
  executeMock: vi.fn(),
  inviteUserByEmailMock: vi.fn(),
  updateUserByIdMock: vi.fn(),
}));

vi.mock("@/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

const getDbMock = vi.mocked(getDb);
const createSupabaseAdminClientMock = vi.mocked(createSupabaseAdminClient);

function createWorkspaceUser(overrides: Partial<WorkspaceUser> = {}): WorkspaceUser {
  return {
    id: "user-1",
    email: "user@example.com",
    fullName: "Example User",
    workspaceRole: "pro",
    accountStatus: "active",
    providers: ["email"],
    identities: [],
    createdAt: "2026-04-15T20:00:00.000Z",
    updatedAt: "2026-04-15T20:00:00.000Z",
    invitedAt: null,
    confirmedAt: "2026-04-15T20:05:00.000Z",
    emailConfirmedAt: "2026-04-15T20:05:00.000Z",
    lastLoginAt: "2026-04-15T20:10:00.000Z",
    bannedUntil: null,
    ...overrides,
  };
}

function createWorkspaceUserRecord(
  overrides: Partial<{
    id: string;
    email: string | null;
    raw_user_meta_data: Record<string, unknown> | null;
    raw_app_meta_data: Record<string, unknown> | null;
    invited_at: string | null;
    confirmed_at: string | null;
    email_confirmed_at: string | null;
    last_sign_in_at: string | null;
    banned_until: string | null;
  }> = {},
) {
  return {
    id: "auth-user-1",
    email: "pro@example.com",
    raw_user_meta_data: { full_name: "Pro User" },
    raw_app_meta_data: {
      provider: "email",
      providers: ["email"],
      workspace_role: "pro",
    },
    created_at: "2026-04-15T20:00:00.000Z",
    updated_at: "2026-04-15T20:00:00.000Z",
    invited_at: "2026-04-15T20:01:00.000Z",
    confirmed_at: null,
    email_confirmed_at: null,
    last_sign_in_at: null,
    banned_until: null,
    identities: [],
    ...overrides,
  };
}

function createAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "auth-user-1",
    app_metadata: {
      provider: "email",
      providers: ["email"],
      workspace_role: "admin",
    },
    user_metadata: {
      full_name: "Blake Lewis",
    },
    aud: "authenticated",
    confirmation_sent_at: null,
    recovery_sent_at: null,
    email_change_sent_at: null,
    new_email: null,
    invited_at: "2026-04-15T20:01:00.000Z",
    action_link: null,
    email: "admin@example.com",
    phone: "",
    created_at: "2026-04-15T20:00:00.000Z",
    confirmed_at: "2026-04-15T20:02:00.000Z",
    email_confirmed_at: "2026-04-15T20:02:00.000Z",
    phone_confirmed_at: null,
    last_sign_in_at: "2026-04-15T20:03:00.000Z",
    role: "authenticated",
    updated_at: "2026-04-15T20:04:00.000Z",
    identities: [
      {
        id: "identity-1",
        user_id: "auth-user-1",
        identity_id: "identity-1",
        provider: "email",
        created_at: "2026-04-15T20:00:00.000Z",
        last_sign_in_at: "2026-04-15T20:03:00.000Z",
        updated_at: "2026-04-15T20:04:00.000Z",
        identity_data: {},
      },
    ],
    is_anonymous: false,
    factors: null,
    ...overrides,
  } as AuthUser;
}

describe("user-management", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getDbMock.mockReturnValue({
      execute: executeMock,
    } as never);
    createSupabaseAdminClientMock.mockReturnValue({
      auth: {
        admin: {
          inviteUserByEmail: inviteUserByEmailMock,
          updateUserById: updateUserByIdMock,
        },
      },
    } as never);
    updateUserByIdMock.mockResolvedValue({ data: { user: null }, error: null });
  });

  it("maps invited users to pending invite status", () => {
    expect(
      getWorkspaceUserAccountStatus({
        banned_until: undefined,
        invited_at: "2026-04-15T20:01:00.000Z",
        confirmed_at: undefined,
        email_confirmed_at: undefined,
        last_sign_in_at: undefined,
      }),
    ).toBe("pending_invite");
  });

  it("maps unconfirmed users to pending confirmation status", () => {
    expect(
      getWorkspaceUserAccountStatus({
        banned_until: undefined,
        invited_at: undefined,
        confirmed_at: undefined,
        email_confirmed_at: undefined,
        last_sign_in_at: undefined,
      }),
    ).toBe("pending_confirmation");
  });

  it("maps banned users to disabled status", () => {
    expect(
      getWorkspaceUserAccountStatus(
        {
          banned_until: "3026-04-15T20:00:00.000Z",
          invited_at: undefined,
          confirmed_at: "2026-04-15T20:02:00.000Z",
          email_confirmed_at: "2026-04-15T20:02:00.000Z",
          last_sign_in_at: "2026-04-15T20:03:00.000Z",
        },
        new Date("2026-04-15T20:00:00.000Z"),
      ),
    ).toBe("disabled");
  });

  it("maps auth metadata into the stable workspace user shape", () => {
    const user = mapAuthUserToWorkspaceUser(createAuthUser());

    expect(user).toMatchObject({
      id: "auth-user-1",
      email: "admin@example.com",
      fullName: "Blake Lewis",
      workspaceRole: "admin",
      accountStatus: "active",
      providers: ["email"],
      identities: [
        {
          id: "identity-1",
          provider: "email",
        },
      ],
    });
  });

  it("defaults missing workspace roles to pro", () => {
    const user = mapAuthUserToWorkspaceUser(
      createAuthUser({
        app_metadata: {
          provider: "email",
          providers: ["email"],
        },
      }),
    );

    expect(user.workspaceRole).toBe("pro");
  });

  it("maps legacy viewer workspace roles to pro", () => {
    const user = mapAuthUserToWorkspaceUser(
      createAuthUser({
        app_metadata: {
          provider: "email",
          providers: ["email"],
          workspace_role: "viewer",
        },
      }),
    );

    expect(user.workspaceRole).toBe("pro");
  });

  it("merges workspace roles into existing app metadata", () => {
    expect(
      mergeWorkspaceRoleIntoAppMetadata(
        {
          provider: "email",
          providers: ["email"],
        },
        "admin",
      ),
    ).toEqual({
      provider: "email",
      providers: ["email"],
      workspace_role: "admin",
    });
  });

  it("counts only active admins", () => {
    expect(
      getActiveWorkspaceAdminCount([
        createWorkspaceUser({
          id: "admin-1",
          workspaceRole: "admin",
          accountStatus: "active",
        }),
        createWorkspaceUser({
          id: "admin-2",
          workspaceRole: "admin",
          accountStatus: "disabled",
        }),
        createWorkspaceUser({
          id: "pro-1",
          workspaceRole: "pro",
          accountStatus: "active",
        }),
      ]),
    ).toBe(1);
  });

  it("rejects self role and status changes", () => {
    expect(() =>
      assertWorkspaceUserMutationAllowed({
        currentUserId: "user-1",
        targetUser: createWorkspaceUser({ id: "user-1" }),
        users: [createWorkspaceUser({ id: "user-1" })],
        workspaceRole: "admin",
      }),
    ).toThrowError(
      new WorkspaceUserPermissionError(
        "You cannot change your own role or status from User Management.",
        400,
      ),
    );
  });

  it("rejects disabling the last active admin", () => {
    expect(() =>
      assertWorkspaceUserMutationAllowed({
        currentUserId: "admin-2",
        targetUser: createWorkspaceUser({
          id: "admin-1",
          workspaceRole: "admin",
          accountStatus: "active",
        }),
        users: [
          createWorkspaceUser({
            id: "admin-1",
            workspaceRole: "admin",
            accountStatus: "active",
          }),
          createWorkspaceUser({
            id: "pro-1",
            workspaceRole: "pro",
            accountStatus: "active",
          }),
        ],
        disabled: true,
      }),
    ).toThrowError(
      new WorkspaceUserPermissionError(
        "The last active admin cannot be disabled or demoted.",
      ),
    );
  });

  it("rejects demoting the last active admin to basic", () => {
    expect(() =>
      assertWorkspaceUserMutationAllowed({
        currentUserId: "admin-2",
        targetUser: createWorkspaceUser({
          id: "admin-1",
          workspaceRole: "admin",
          accountStatus: "active",
        }),
        users: [
          createWorkspaceUser({
            id: "admin-1",
            workspaceRole: "admin",
            accountStatus: "active",
          }),
        ],
        workspaceRole: "basic",
      }),
    ).toThrowError(
      new WorkspaceUserPermissionError(
        "The last active admin cannot be disabled or demoted.",
      ),
    );
  });

  it("allows changes when another active admin still exists", () => {
    expect(() =>
      assertWorkspaceUserMutationAllowed({
        currentUserId: "admin-2",
        targetUser: createWorkspaceUser({
          id: "admin-1",
          workspaceRole: "admin",
          accountStatus: "active",
        }),
        users: [
          createWorkspaceUser({
            id: "admin-1",
            workspaceRole: "admin",
            accountStatus: "active",
          }),
          createWorkspaceUser({
            id: "admin-2",
            workspaceRole: "admin",
            accountStatus: "active",
          }),
        ],
        workspaceRole: "pro",
      }),
    ).not.toThrow();
  });

  it("rejects password reset emails for users without an email address", () => {
    expect(() =>
      assertWorkspaceUserPasswordResetAllowed(
        createWorkspaceUser({
          email: null,
        }),
      ),
    ).toThrowError(
      new WorkspaceUserActionError("This account does not have an email address.", 400),
    );
  });

  it("rejects password reset emails for disabled accounts", () => {
    expect(() =>
      assertWorkspaceUserPasswordResetAllowed(
        createWorkspaceUser({
          accountStatus: "disabled",
        }),
      ),
    ).toThrowError(
      new WorkspaceUserActionError(
        "Re-enable the account before sending a password reset email.",
        409,
      ),
    );
  });

  it("allows password reset emails for active users", () => {
    expect(() =>
      assertWorkspaceUserPasswordResetAllowed(createWorkspaceUser()),
    ).not.toThrow();
  });

  it("keeps the allowlist approval when inviting a user succeeds", async () => {
    inviteUserByEmailMock.mockResolvedValue({
      data: {
        user: {
          id: "auth-user-1",
          app_metadata: {
            provider: "email",
            providers: ["email"],
          },
        },
      },
      error: null,
    });
    executeMock
      .mockResolvedValueOnce([{ created: true }])
      .mockResolvedValueOnce([createWorkspaceUserRecord()]);

    const user = await inviteWorkspaceUser({
      email: "pro@example.com",
      fullName: "Pro User",
      workspaceRole: "pro",
    });

    expect(user).toMatchObject({
      email: "pro@example.com",
      fullName: "Pro User",
      workspaceRole: "pro",
      accountStatus: "pending_invite",
    });
    expect(executeMock).toHaveBeenCalledTimes(2);
    expect(updateUserByIdMock).toHaveBeenCalledWith("auth-user-1", {
      app_metadata: {
        provider: "email",
        providers: ["email"],
        workspace_role: "pro",
      },
    });
  });

  it("removes a newly-created allowlist approval when invite creation fails", async () => {
    const inviteError = Object.assign(new Error("Invite failed"), {
      code: "invite_failed",
    });
    inviteUserByEmailMock.mockResolvedValue({
      data: { user: null },
      error: inviteError,
    });
    executeMock.mockResolvedValueOnce([{ created: true }]).mockResolvedValueOnce([]);

    await expect(
      inviteWorkspaceUser({
        email: "basic@example.com",
        workspaceRole: "basic",
      }),
    ).rejects.toBe(inviteError);

    expect(executeMock).toHaveBeenCalledTimes(2);
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("does not remove pre-existing allowlist approvals when invite creation fails", async () => {
    const inviteError = Object.assign(new Error("Invite failed"), {
      code: "invite_failed",
    });
    inviteUserByEmailMock.mockResolvedValue({
      data: { user: null },
      error: inviteError,
    });
    executeMock.mockResolvedValueOnce([{ created: false }]);

    await expect(
      inviteWorkspaceUser({
        email: "pro@example.com",
        workspaceRole: "pro",
      }),
    ).rejects.toBe(inviteError);

    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });
});
