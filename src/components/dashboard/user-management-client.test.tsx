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

function renderUserManagementClient(users: WorkspaceUser[] = [createUser()]) {
  return render(
    <UserManagementClient
      currentUserId="admin-1"
      initialUsers={users}
    />,
  );
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

  it("renders the simplified table and compact invite form", () => {
    renderUserManagementClient();

    expect(screen.queryByText("Total users")).toBeNull();
    expect(screen.queryByText("Active admins")).toBeNull();
    expect(screen.queryByText("Disabled accounts")).toBeNull();
    expect(screen.queryByLabelText("Full name")).toBeNull();
    expect(screen.queryByText("Last login")).toBeNull();
    expect(screen.queryByText("Created")).toBeNull();
    expect(screen.queryByText("Details")).toBeNull();
    expect(screen.queryByText("Send password reset email")).toBeNull();
  });

  it("opens the details sheet when a user row is clicked", async () => {
    renderUserManagementClient([
      createUser(),
      createUser({
        id: "user-2",
        email: "admin@example.com",
        fullName: "Admin User",
        workspaceRole: "admin",
      }),
    ]);

    const row = screen.getByText("Admin User").closest("tr");

    expect(row).toBeTruthy();
    fireEvent.click(row!);

    expect(await screen.findByText("Review identifiers, providers, access level, and account status.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Admin User" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send password reset email" })).toBeTruthy();
  });

  it("sends password reset emails for the selected user", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderUserManagementClient();

    const row = screen.getByText("Viewer User").closest("tr");

    expect(row).toBeTruthy();
    fireEvent.click(row!);
    fireEvent.click(await screen.findByRole("button", { name: "Send password reset email" }));

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
    renderUserManagementClient([
      createUser({
        email: null,
      }),
    ]);

    const row = screen.getByText("Viewer User").closest("tr");

    expect(row).toBeTruthy();
    fireEvent.click(row!);

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
