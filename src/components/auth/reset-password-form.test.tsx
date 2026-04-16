// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { ResetPasswordForm } from "./reset-password-form";

const pushMock = vi.fn();
const refreshMock = vi.fn();

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

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.history.replaceState({}, "", "/reset-password");
  });

  afterEach(() => {
    cleanup();
  });

  it("requires matching passwords", async () => {
    const updateUser = vi.fn();

    createSupabaseBrowserClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
        setSession: vi.fn(),
        updateUser,
        signOut: vi.fn(),
      },
    } as never);

    render(<ResetPasswordForm initialCanReset />);

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "SmokePass123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "DifferentPass456!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save new password" }));

    expect(await screen.findByText("Passwords must match.")).toBeTruthy();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("updates the password, signs out, and returns to sign in", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    const signOut = vi.fn().mockResolvedValue({ error: null });

    createSupabaseBrowserClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
        setSession: vi.fn(),
        updateUser,
        signOut,
      },
    } as never);

    render(<ResetPasswordForm initialCanReset />);

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "NewSmokePass456!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "NewSmokePass456!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save new password" }));

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({
        password: "NewSmokePass456!",
      });
      expect(signOut).toHaveBeenCalled();
    });
    expect(pushMock).toHaveBeenCalledWith(
      "/?message=Password updated. Sign in with your new password.",
    );
    expect(refreshMock).toHaveBeenCalled();
  });

  it("enables password reset when the recovery session is restored client-side", async () => {
    window.location.hash =
      "#access_token=token&refresh_token=refresh-token&type=recovery";

    const getSession = vi.fn().mockResolvedValue({
      data: { session: null },
    });
    const setSession = vi.fn().mockResolvedValue({ error: null });
    const updateUser = vi.fn();
    const signOut = vi.fn();

    createSupabaseBrowserClientMock.mockReturnValue({
      auth: {
        getSession,
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
        setSession,
        updateUser,
        signOut,
      },
    } as never);

    render(<ResetPasswordForm initialCanReset={false} />);

    expect(
      screen.getByText("One moment while the password reset session is restored."),
    ).toBeTruthy();

    await waitFor(() => {
      expect(setSession).toHaveBeenCalledWith({
        access_token: "token",
        refresh_token: "refresh-token",
      });
      expect(
        screen.getByRole("button", { name: "Save new password" }),
      ).toBeTruthy();
    });
  });

  it("enables password reset when a PKCE recovery code is exchanged client-side", async () => {
    window.history.replaceState({}, "", "/reset-password?code=pkce-code");

    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });
    const getSession = vi.fn().mockResolvedValue({
      data: { session: null },
    });

    createSupabaseBrowserClientMock.mockReturnValue({
      auth: {
        exchangeCodeForSession,
        getSession,
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
        setSession: vi.fn(),
        updateUser: vi.fn(),
        signOut: vi.fn(),
      },
    } as never);

    render(<ResetPasswordForm initialCanReset={false} />);

    expect(
      screen.getByText("One moment while the password reset session is restored."),
    ).toBeTruthy();

    await waitFor(() => {
      expect(exchangeCodeForSession).toHaveBeenCalledWith("pkce-code");
      expect(
        screen.getByRole("button", { name: "Save new password" }),
      ).toBeTruthy();
    });
  });
});
