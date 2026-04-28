import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import {
  inviteWorkspaceUser,
  listWorkspaceUsers,
  WorkspaceUserPermissionError,
} from "@/lib/user-management";
import { GET, POST } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/user-management", async () => {
  const actual = await vi.importActual<typeof import("@/lib/user-management")>(
    "@/lib/user-management",
  );

  return {
    ...actual,
    inviteWorkspaceUser: vi.fn(),
    listWorkspaceUsers: vi.fn(),
  };
});

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const inviteWorkspaceUserMock = vi.mocked(inviteWorkspaceUser);
const listWorkspaceUsersMock = vi.mocked(listWorkspaceUsers);

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
  updatedAt: "2026-04-15T20:00:00.000Z",
  invitedAt: "2026-04-15T20:01:00.000Z",
  confirmedAt: null,
  emailConfirmedAt: null,
  lastLoginAt: null,
  bannedUntil: null,
};

describe("/api/admin/users", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getCurrentIdentityMock.mockResolvedValue(identity);
  });

  it("rejects unauthenticated list requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(listWorkspaceUsersMock).not.toHaveBeenCalled();
  });

  it("rejects non-admin list requests", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ...identity,
      email: "basic@example.com",
      workspaceRole: "basic",
      isDatasetAdmin: false,
    });

    const response = await GET();

    expect(response.status).toBe(403);
    expect(listWorkspaceUsersMock).not.toHaveBeenCalled();
  });

  it("lists workspace users for admins", async () => {
    listWorkspaceUsersMock.mockResolvedValue([user]);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ users: [user] });
  });

  it("returns a generic list error when loading users fails", async () => {
    listWorkspaceUsersMock.mockRejectedValue(new Error("load failed"));

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Could not load users." });
  });

  it("rejects invalid invite payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ email: "", workspaceRole: "pro" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(inviteWorkspaceUserMock).not.toHaveBeenCalled();
  });

  it("rejects legacy viewer as a writable invite role", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: "viewer@example.com",
          workspaceRole: "viewer",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(inviteWorkspaceUserMock).not.toHaveBeenCalled();
  });

  it("invites users through the admin helper", async () => {
    inviteWorkspaceUserMock.mockResolvedValue(user);

    const response = await POST(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: "pro@example.com",
          fullName: "Pro User",
          workspaceRole: "pro",
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ user });
    expect(inviteWorkspaceUserMock).toHaveBeenCalledWith({
      email: "pro@example.com",
      fullName: "Pro User",
      workspaceRole: "pro",
      redirectTo:
        "http://localhost/?message=Check+your+email+to+finish+setting+up+your+account.",
    });
  });

  it("returns permission errors from the invite helper", async () => {
    inviteWorkspaceUserMock.mockRejectedValue(
      new WorkspaceUserPermissionError("That invite is not allowed.", 409),
    );

    const response = await POST(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: "basic@example.com",
          workspaceRole: "basic",
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "That invite is not allowed.",
    });
  });

  it("returns a generic invite error when the invite helper fails unexpectedly", async () => {
    inviteWorkspaceUserMock.mockRejectedValue(new Error("invite failed"));

    const response = await POST(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: "pro@example.com",
          workspaceRole: "pro",
        }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Could not invite the user.",
    });
  });
});
