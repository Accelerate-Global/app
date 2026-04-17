// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceUser } from "@/lib/api-types";

import { UserManagementClient } from "./user-management-client";

const fetchMock = vi.fn();

function createUser(overrides: Partial<WorkspaceUser> = {}): WorkspaceUser {
  return {
    id: "user-1",
    email: "viewer@example.com",
    fullName: "Viewer User",
    workspaceRole: "viewer",
    accountStatus: "active",
    providers: ["email"],
    identities: [],
    createdAt: "2026-04-15T20:00:00.000Z",
    updatedAt: "2026-04-15T20:00:00.000Z",
    invitedAt: null,
    confirmedAt: "2026-04-15T20:02:00.000Z",
    emailConfirmedAt: "2026-04-15T20:02:00.000Z",
    lastLoginAt: "2026-04-15T20:03:00.000Z",
    bannedUntil: null,
    ...overrides,
  };
}

describe("UserManagementClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("sends password reset emails for the selected user", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(
      <UserManagementClient
        currentUserId="admin-1"
        initialUsers={[createUser()]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Send password reset email" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/users/user-1/password-reset", {
        method: "POST",
      });
    });

    expect(
      await screen.findByText("Password reset email sent to viewer@example.com."),
    ).toBeTruthy();
  });

  it("disables password reset for accounts without an email address", () => {
    render(
      <UserManagementClient
        currentUserId="admin-1"
        initialUsers={[
          createUser({
            email: null,
          }),
        ]}
      />,
    );

    const button = screen.getByRole("button", { name: "Send password reset email" });

    expect(button).toBeTruthy();
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText(
        "This account cannot receive a password reset email because no email address is stored.",
      ),
    ).toBeTruthy();
  });
});
