import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import {
  resendWorkspaceUserInviteEmail,
  WorkspaceUserActionError,
  WorkspaceUserNotFoundError,
  WorkspaceUserPermissionError,
} from "@/lib/user-management";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/user-management", async () => {
  const actual = await vi.importActual<typeof import("@/lib/user-management")>(
    "@/lib/user-management",
  );

  return {
    ...actual,
    resendWorkspaceUserInviteEmail: vi.fn(),
  };
});

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const resendWorkspaceUserInviteEmailMock = vi.mocked(resendWorkspaceUserInviteEmail);

const identity = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Blake Lewis",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

const user = {
  id: "user-1",
  email: "pro@example.com",
  fullName: "Pro User",
  workspaceRole: "pro" as const,
  accountStatus: "pending_invite" as const,
  providers: ["email"],
  identities: [],
  createdAt: "2026-04-15T20:00:00.000Z",
  updatedAt: "2026-04-15T20:10:00.000Z",
  invitedAt: "2026-04-15T20:10:00.000Z",
  confirmedAt: null,
  emailConfirmedAt: null,
  lastLoginAt: null,
  bannedUntil: null,
};

describe("/api/admin/users/[userId]/invite-resend", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects unauthenticated requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/admin/users/user-1/invite-resend", {
        method: "POST",
      }),
      { params: Promise.resolve({ userId: "user-1" }) },
    );

    expect(response.status).toBe(401);
    expect(resendWorkspaceUserInviteEmailMock).not.toHaveBeenCalled();
  });

  it("rejects non-admin requests", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      email: "basic@example.com",
      workspaceRole: "basic",
      isDatasetAdmin: false,
    });

    const response = await POST(
      new Request("http://localhost/api/admin/users/user-1/invite-resend", {
        method: "POST",
      }),
      { params: Promise.resolve({ userId: "user-1" }) },
    );

    expect(response.status).toBe(403);
    expect(resendWorkspaceUserInviteEmailMock).not.toHaveBeenCalled();
  });

  it("resends invite emails for admins", async () => {
    resendWorkspaceUserInviteEmailMock.mockResolvedValue(user);

    const response = await POST(
      new Request("http://localhost/api/admin/users/user-1/invite-resend", {
        method: "POST",
      }),
      { params: Promise.resolve({ userId: "user-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ user });
    expect(resendWorkspaceUserInviteEmailMock).toHaveBeenCalledWith({
      currentUserRole: "admin",
      userId: "user-1",
      redirectTo: "http://localhost/auth/confirm?next=%2Freset-password",
    });
  });

  it("returns not found when the user does not exist", async () => {
    resendWorkspaceUserInviteEmailMock.mockRejectedValue(
      new WorkspaceUserNotFoundError(),
    );

    const response = await POST(
      new Request("http://localhost/api/admin/users/user-1/invite-resend", {
        method: "POST",
      }),
      { params: Promise.resolve({ userId: "user-1" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "User not found." });
  });

  it("returns action errors from the admin helper", async () => {
    resendWorkspaceUserInviteEmailMock.mockRejectedValue(
      new WorkspaceUserActionError(
        "Only pending invites can receive another invite email.",
        409,
      ),
    );

    const response = await POST(
      new Request("http://localhost/api/admin/users/user-1/invite-resend", {
        method: "POST",
      }),
      { params: Promise.resolve({ userId: "user-1" }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Only pending invites can receive another invite email.",
    });
  });

  it("returns permission errors from the admin helper", async () => {
    resendWorkspaceUserInviteEmailMock.mockRejectedValue(
      new WorkspaceUserPermissionError(
        "Only super admins can manage super admin accounts.",
        403,
      ),
    );

    const response = await POST(
      new Request("http://localhost/api/admin/users/user-1/invite-resend", {
        method: "POST",
      }),
      { params: Promise.resolve({ userId: "user-1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Only super admins can manage super admin accounts.",
    });
  });

  it("returns a generic error when the admin helper fails unexpectedly", async () => {
    resendWorkspaceUserInviteEmailMock.mockRejectedValue(new Error("send failed"));

    const response = await POST(
      new Request("http://localhost/api/admin/users/user-1/invite-resend", {
        method: "POST",
      }),
      { params: Promise.resolve({ userId: "user-1" }) },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Could not resend the invite email.",
    });
  });
});
