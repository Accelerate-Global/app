// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceUser } from "@/lib/api-types";

import { UserManagementClient } from "./user-management-client";

const fetchMock = vi.fn();
const { trackAppEventMock } = vi.hoisted(() => ({
  trackAppEventMock: vi.fn(),
}));

vi.mock("@/lib/analytics-client", () => ({
  trackAppEvent: trackAppEventMock,
}));

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
    const { container } = renderUserManagementClient();

    expect(screen.queryByText("Total users")).toBeNull();
    expect(screen.queryByText("Active admins")).toBeNull();
    expect(screen.queryByText("Disabled accounts")).toBeNull();
    expect(screen.queryByLabelText("Full name")).toBeNull();
    expect(screen.queryByText("Last login")).toBeNull();
    expect(screen.queryByText("Created")).toBeNull();
    expect(screen.queryByText("Details")).toBeNull();
    expect(screen.queryByText("Send password reset email")).toBeNull();
    expect(screen.getByText("All roles")).toBeTruthy();
    expect(screen.getByText("All statuses")).toBeTruthy();

    const inviteFormGrid = container.querySelector(".md\\:grid-cols-\\[minmax\\(0\\,1fr\\)_12rem_auto\\]");

    expect(inviteFormGrid?.className).toContain("md:items-start");
  });

  it("opens the details sheet when a user row is clicked", async () => {
    const { container } = renderUserManagementClient([
      createUser(),
      createUser({
        id: "user-2",
        email: "admin@example.com",
        fullName: "Admin User",
        workspaceRole: "admin",
        identities: [
          {
            id: "identity-1",
            provider: "email",
            createdAt: "2026-04-15T20:00:00.000Z",
            lastLoginAt: "2026-04-16T16:30:00.000Z",
          },
        ],
      }),
    ]);

    const row = screen.getByText("Admin User").closest("tr");

    expect(row).toBeTruthy();
    fireEvent.click(row!);

    expect(await screen.findByText("Review identifiers, providers, access level, and account status.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Admin User" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send password reset email" })).toBeTruthy();
    expect(screen.getAllByText("email")).toHaveLength(1);
    expect(container.querySelector(".rounded-2xl.border.border-border.p-4")).toBeNull();
    expect(container.querySelector(".rounded-xl.border.border-border.p-3.text-sm")).toBeNull();
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "user_record_opened",
      expect.objectContaining({
        source_surface: "user_management_table",
        success: true,
        target_user_id: "user-2",
        target_status: "active",
        target_role: "admin",
      }),
    );
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
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "admin_password_reset_sent",
      expect.objectContaining({
        source_surface: "user_detail_sheet",
        success: true,
        target_user_id: "user-1",
        to_status: "active",
      }),
    );
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
