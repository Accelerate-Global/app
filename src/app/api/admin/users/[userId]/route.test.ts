import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import {
  updateWorkspaceUser,
  WorkspaceUserNotFoundError,
  WorkspaceUserPermissionError,
} from "@/lib/user-management";
import { PATCH } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/user-management", async () => {
  const actual = await vi.importActual<typeof import("@/lib/user-management")>(
    "@/lib/user-management",
  );

  return {
    ...actual,
    updateWorkspaceUser: vi.fn(),
  };
});

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const updateWorkspaceUserMock = vi.mocked(updateWorkspaceUser);

const identity = {
  ownerId: "admin-1",
  email: "admin@example.com",
  fullName: "Blake Lewis",
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

const user = {
  id: "user-1",
  email: "viewer@example.com",
  fullName: "Viewer User",
  workspaceRole: "admin" as const,
  accountStatus: "active" as const,
  providers: ["email"],
  identities: [],
  createdAt: "2026-04-15T20:00:00.000Z",
  updatedAt: "2026-04-15T20:00:00.000Z",
  invitedAt: null,
  confirmedAt: "2026-04-15T20:02:00.000Z",
  emailConfirmedAt: "2026-04-15T20:02:00.000Z",
  lastLoginAt: "2026-04-15T20:03:00.000Z",
  bannedUntil: null,
};

describe("/api/admin/users/[userId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects unauthenticated updates", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user-1", {
        method: "PATCH",
        body: JSON.stringify({ workspaceRole: "admin" }),
      }),
      { params: Promise.resolve({ userId: "user-1" }) },
    );

    expect(response.status).toBe(401);
    expect(updateWorkspaceUserMock).not.toHaveBeenCalled();
  });

  it("rejects non-admin updates", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      email: "viewer@example.com",
      isDatasetAdmin: false,
    });

    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user-1", {
        method: "PATCH",
        body: JSON.stringify({ workspaceRole: "admin" }),
      }),
      { params: Promise.resolve({ userId: "user-1" }) },
    );

    expect(response.status).toBe(403);
    expect(updateWorkspaceUserMock).not.toHaveBeenCalled();
  });

  it("rejects invalid payloads", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user-1", {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ userId: "user-1" }) },
    );

    expect(response.status).toBe(400);
    expect(updateWorkspaceUserMock).not.toHaveBeenCalled();
  });

  it("updates user role and status for admins", async () => {
    updateWorkspaceUserMock.mockResolvedValue(user);

    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user-1", {
        method: "PATCH",
        body: JSON.stringify({ workspaceRole: "admin", disabled: false }),
      }),
      { params: Promise.resolve({ userId: "user-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ user });
    expect(updateWorkspaceUserMock).toHaveBeenCalledWith({
      currentUserId: "admin-1",
      userId: "user-1",
      workspaceRole: "admin",
      disabled: false,
    });
  });

  it("returns not found when the user does not exist", async () => {
    updateWorkspaceUserMock.mockRejectedValue(new WorkspaceUserNotFoundError());

    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user-1", {
        method: "PATCH",
        body: JSON.stringify({ disabled: true }),
      }),
      { params: Promise.resolve({ userId: "user-1" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "User not found." });
  });

  it("returns permission failures from the admin helper", async () => {
    updateWorkspaceUserMock.mockRejectedValue(
      new WorkspaceUserPermissionError(
        "The last active admin cannot be disabled or demoted.",
      ),
    );

    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user-1", {
        method: "PATCH",
        body: JSON.stringify({ disabled: true }),
      }),
      { params: Promise.resolve({ userId: "user-1" }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "The last active admin cannot be disabled or demoted.",
    });
  });

  it("returns self-change rejections from the admin helper", async () => {
    updateWorkspaceUserMock.mockRejectedValue(
      new WorkspaceUserPermissionError(
        "You cannot change your own role or status from User Management.",
        400,
      ),
    );

    const response = await PATCH(
      new Request("http://localhost/api/admin/users/admin-1", {
        method: "PATCH",
        body: JSON.stringify({ workspaceRole: "viewer" }),
      }),
      { params: Promise.resolve({ userId: "admin-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "You cannot change your own role or status from User Management.",
    });
  });

  it("returns a generic error when the admin helper fails unexpectedly", async () => {
    updateWorkspaceUserMock.mockRejectedValue(new Error("update failed"));

    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user-1", {
        method: "PATCH",
        body: JSON.stringify({ disabled: true }),
      }),
      { params: Promise.resolve({ userId: "user-1" }) },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Could not update the user.",
    });
  });
});
