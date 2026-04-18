// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { AuthForm } from "./auth-form";

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

describe("AuthForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    cleanup();
  });

  it("signs in with Supabase password auth", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { session: { access_token: "token" } },
      error: null,
    });

    createSupabaseBrowserClientMock.mockReturnValue({
      auth: { signInWithPassword },
    } as never);

    render(<AuthForm mode="sign-in" />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "viewer@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "SmokePass123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: "viewer@example.com",
        password: "SmokePass123!",
      });
    });
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "auth_sign_in_succeeded",
      expect.objectContaining({
        route: "sign_in",
        actor_owner_id: "anonymous",
        workspace_role: "anonymous",
        source_surface: "auth_form",
        success: true,
      }),
    );
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("blocks sign-up when the allowlist precheck rejects the email", async () => {
    const signUp = vi.fn();

    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        message:
          "This email address has not been granted access yet. Ask an administrator to add it to the signup allowlist first.",
      }),
    });
    createSupabaseBrowserClientMock.mockReturnValue({
      auth: { signUp },
    } as never);

    render(<AuthForm mode="sign-up" />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "blocked@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "SmokePass123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByText(
        "This email address has not been granted access yet. Ask an administrator to add it to the signup allowlist first.",
      ),
    ).toBeTruthy();
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "auth_sign_up_started",
      expect.objectContaining({
        route: "sign_up",
        source_surface: "auth_form",
        success: true,
      }),
    );
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "auth_sign_up_allowlist_rejected",
      expect.objectContaining({
        route: "sign_up",
        source_surface: "auth_form",
        success: false,
        error_code: "allowlist_rejected",
      }),
    );
    expect(signUp).not.toHaveBeenCalled();
  });

  it("starts sign-up with a sanitized auth confirm redirect", async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: { session: { access_token: "token" } },
      error: null,
    });

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    createSupabaseBrowserClientMock.mockReturnValue({
      auth: { signUp },
    } as never);

    render(<AuthForm mode="sign-up" />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "allowed@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "SmokePass123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/auth/sign-up", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ email: "allowed@example.com" }),
      });
      expect(signUp).toHaveBeenCalledWith({
        email: "allowed@example.com",
        password: "SmokePass123!",
        options: {
          emailRedirectTo: expect.stringContaining(
            "/auth/confirm?next=%2Fdashboard",
          ),
        },
      });
    });
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "auth_sign_up_succeeded",
      expect.objectContaining({
        route: "sign_up",
        source_surface: "auth_form",
        success: true,
      }),
    );
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  it("returns the user to sign in when sign-up needs email confirmation", async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    });

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    createSupabaseBrowserClientMock.mockReturnValue({
      auth: { signUp },
    } as never);

    render(<AuthForm mode="sign-up" />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "allowed@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "SmokePass123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        "/?message=Check your email to confirm your account, then sign in.",
      );
    });
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "auth_sign_up_confirmation_required",
      expect.objectContaining({
        route: "sign_up",
        source_surface: "auth_form",
        success: true,
      }),
    );
  });
});
