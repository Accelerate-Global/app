// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { AccountProfileForm } from "./account-profile-form";

const pushMock = vi.fn();
const refreshMock = vi.fn();
const fetchMock = vi.fn();
const { trackAppEventMock } = vi.hoisted(() => ({
  trackAppEventMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: vi.fn(),
}));

vi.mock("@/lib/analytics-client", () => ({
  trackAppEvent: trackAppEventMock,
}));

const createSupabaseBrowserClientMock = vi.mocked(createSupabaseBrowserClient);

const identity = {
  ownerId: "owner-1",
  email: "admin@example.com",
  fullName: "Blake Lewis",
  workspaceRole: "admin" as const,
  isDatasetAdmin: true,
  mode: "supabase" as const,
};

describe("AccountProfileForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    cleanup();
  });

  it("saves the profile name through Supabase metadata updates", async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          user_metadata: { timezone: "pst" },
        },
      },
      error: null,
    });
    const updateUser = vi.fn().mockResolvedValue({ error: null });

    createSupabaseBrowserClientMock.mockReturnValue({
      auth: { getUser, updateUser },
    } as never);

    render(<AccountProfileForm identity={identity} />);

    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Blake L." },
    });
    fireEvent.click(screen.getByText("Save name"));

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({
        data: { timezone: "pst", full_name: "Blake L." },
      });
    });
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "profile_name_updated",
      expect.objectContaining({
        route: "profile",
        actor_owner_id: "owner-1",
        workspace_role: "admin",
        source_surface: "profile_name_form",
        success: true,
      }),
    );
    expect(refreshMock).toHaveBeenCalled();
  });

  it("uses the profile route as the email confirmation redirect target", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });

    createSupabaseBrowserClientMock.mockReturnValue({
      auth: { updateUser },
    } as never);

    render(<AccountProfileForm identity={identity} />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByText("Update email"));

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith(
        { email: "user@example.com" },
        expect.objectContaining({
          emailRedirectTo: expect.stringContaining(
            "/auth/confirm?next=%2Fdashboard%2Fprofile",
          ),
        }),
      );
    });
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "email_change_started",
      expect.objectContaining({
        route: "profile",
        actor_owner_id: "owner-1",
        workspace_role: "admin",
        source_surface: "profile_email_form",
        success: true,
      }),
    );
  });

  it("disables the account through the existing API route", async () => {
    createSupabaseBrowserClientMock.mockReturnValue({
      auth: {},
    } as never);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    render(<AccountProfileForm identity={identity} />);

    fireEvent.click(screen.getByRole("button", { name: "Disable account" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/account/disable", {
        method: "POST",
      });
    });
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "account_disabled_self",
      expect.objectContaining({
        route: "profile",
        actor_owner_id: "owner-1",
        workspace_role: "admin",
        source_surface: "profile_disable_form",
        success: true,
      }),
    );
    expect(pushMock).toHaveBeenCalledWith("/");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("renders profile controls read-only for basic users", () => {
    render(
      <AccountProfileForm
        identity={{
          ...identity,
          workspaceRole: "basic",
          isDatasetAdmin: false,
        }}
      />,
    );

    expect((screen.getByLabelText("Full name") as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByLabelText("Email address") as HTMLInputElement).disabled,
    ).toBe(true);
    expect(screen.queryByRole("button", { name: "Save name" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Update email" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Disable account" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(createSupabaseBrowserClientMock).not.toHaveBeenCalled();
  });
});
