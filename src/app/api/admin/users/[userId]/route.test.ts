import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import {
  deleteWorkspaceUser,
  updateWorkspaceUser,
  WorkspaceUserNotFoundError,
  WorkspaceUserPermissionError,
} from "@/lib/user-management";
import { DELETE, PATCH } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/user-management", async () => {
  const actual = await vi.importActual<typeof import("@/lib/user-management")>(
    "@/lib/user-management",
  );

  return {
    ...actual,
    deleteWorkspaceUser: vi.fn(),
    updateWorkspaceUser: vi.fn(),
  };
});

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const deleteWorkspaceUserMock = vi.mocked(deleteWorkspaceUser);
const updateWorkspaceUserMock = vi.mocked(updateWorkspaceUser);

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
      email: "basic@example.com",
      workspaceRole: "basic",
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
      currentUserRole: "admin",
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
    await expect(response.json()).resolves.toEqual({
      error: "User not found.",
    });
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
        body: JSON.stringify({ workspaceRole: "basic" }),
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

  it("rejects unauthenticated deletions", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost/api/admin/users/user-1", { method: "DELETE" }),
      { params: Promise.resolve({ userId: "user-1" }) },
    );

    expect(response.status).toBe(401);
    expect(deleteWorkspaceUserMock).not.toHaveBeenCalled();
  });

  it("returns the domain denial when a standard admin tries to delete", async () => {
    deleteWorkspaceUserMock.mockRejectedValue(
      new WorkspaceUserPermissionError("Only super admins can delete accounts.", 403),
    );

    const response = await DELETE(
      new Request("http://localhost/api/admin/users/user-1", { method: "DELETE" }),
      { params: Promise.resolve({ userId: "user-1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Only super admins can delete accounts.",
    });
  });

  it("deletes an eligible account for a super admin", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      workspaceRole: "super_admin",
    });
    deleteWorkspaceUserMock.mockResolvedValue(user);

    const response = await DELETE(
      new Request("http://localhost/api/admin/users/user-1", { method: "DELETE" }),
      { params: Promise.resolve({ userId: "user-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deletedUserId: "user-1" });
    expect(deleteWorkspaceUserMock).toHaveBeenCalledWith({
      currentUserId: "admin-1",
      currentUserRole: "super_admin",
      userId: "user-1",
    });
  });
});

describe("route guard integration", () => {
  it("uses the centralized route guard", async () => {
    const source = await readFile(
      "src/app/api/admin/users/[userId]/route.ts",
      "utf8",
    );

    expect(source).toContain('from "@/lib/route-guard"');
    expect(source).toContain("withRoute(");
  });
});
