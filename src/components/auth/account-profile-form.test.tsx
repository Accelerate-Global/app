// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { AccountProfileForm } from "./account-profile-form";

const pushMock = vi.fn();
const refreshMock = vi.fn();
const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: vi.fn(),
}));

const createSupabaseBrowserClientMock = vi.mocked(createSupabaseBrowserClient);

const identity = {
  ownerId: "owner-1",
  email: "admin@example.com",
  fullName: "Blake Lewis",
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
    expect(refreshMock).toHaveBeenCalled();
  });

  it("uses the profile route as the email confirmation redirect target", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });

    createSupabaseBrowserClientMock.mockReturnValue({
      auth: { updateUser },
    } as never);

    render(<AccountProfileForm identity={identity} />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "updated@example.com" },
    });
    fireEvent.click(screen.getByText("Update email"));

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith(
        { email: "updated@example.com" },
        expect.objectContaining({
          emailRedirectTo: expect.stringContaining(
            "/auth/confirm?next=/dashboard/profile",
          ),
        }),
      );
    });
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
    expect(pushMock).toHaveBeenCalledWith("/");
    expect(refreshMock).toHaveBeenCalled();
  });
});
