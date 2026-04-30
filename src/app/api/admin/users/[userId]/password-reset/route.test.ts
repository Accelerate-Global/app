import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import {
  sendWorkspaceUserPasswordResetEmail,
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
    sendWorkspaceUserPasswordResetEmail: vi.fn(),
  };
});

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const sendWorkspaceUserPasswordResetEmailMock = vi.mocked(sendWorkspaceUserPasswordResetEmail);

const identity = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Blake Lewis",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

describe("/api/admin/users/[userId]/password-reset", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects unauthenticated requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/admin/users/user-1/password-reset", {
        method: "POST",
      }),
      { params: Promise.resolve({ userId: "user-1" }) },
    );

    expect(response.status).toBe(401);
    expect(sendWorkspaceUserPasswordResetEmailMock).not.toHaveBeenCalled();
  });

  it("rejects non-admin requests", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      email: "viewer@example.com",
      isDatasetAdmin: false,
    });

    const response = await POST(
      new Request("http://localhost/api/admin/users/user-1/password-reset", {
        method: "POST",
      }),
      { params: Promise.resolve({ userId: "user-1" }) },
    );

    expect(response.status).toBe(403);
    expect(sendWorkspaceUserPasswordResetEmailMock).not.toHaveBeenCalled();
  });

  it("sends password reset emails for admins", async () => {
    sendWorkspaceUserPasswordResetEmailMock.mockResolvedValue(undefined);

    const response = await POST(
      new Request("http://localhost/api/admin/users/user-1/password-reset", {
        method: "POST",
      }),
      { params: Promise.resolve({ userId: "user-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(sendWorkspaceUserPasswordResetEmailMock).toHaveBeenCalledWith({
      currentUserRole: "admin",
      userId: "user-1",
      redirectTo: "http://localhost/auth/confirm?next=%2Freset-password",
    });
  });

  it("returns not found when the user does not exist", async () => {
    sendWorkspaceUserPasswordResetEmailMock.mockRejectedValue(
      new WorkspaceUserNotFoundError(),
    );

    const response = await POST(
      new Request("http://localhost/api/admin/users/user-1/password-reset", {
        method: "POST",
      }),
      { params: Promise.resolve({ userId: "user-1" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "User not found." });
  });

  it("returns action errors from the admin helper", async () => {
    sendWorkspaceUserPasswordResetEmailMock.mockRejectedValue(
      new WorkspaceUserActionError(
        "Re-enable the account before sending a password reset email.",
        409,
      ),
    );

    const response = await POST(
      new Request("http://localhost/api/admin/users/user-1/password-reset", {
        method: "POST",
      }),
      { params: Promise.resolve({ userId: "user-1" }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Re-enable the account before sending a password reset email.",
    });
  });

  it("returns permission errors from the admin helper", async () => {
    sendWorkspaceUserPasswordResetEmailMock.mockRejectedValue(
      new WorkspaceUserPermissionError(
        "Only super admins can manage super admin accounts.",
        403,
      ),
    );

    const response = await POST(
      new Request("http://localhost/api/admin/users/user-1/password-reset", {
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
    sendWorkspaceUserPasswordResetEmailMock.mockRejectedValue(new Error("send failed"));

    const response = await POST(
      new Request("http://localhost/api/admin/users/user-1/password-reset", {
        method: "POST",
      }),
      { params: Promise.resolve({ userId: "user-1" }) },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Could not send the password reset email.",
    });
  });
});
