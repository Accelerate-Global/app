// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { ResetPasswordForm } from "./reset-password-form";

const pushMock = vi.fn();
const refreshMock = vi.fn();
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

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.history.replaceState({}, "", "/reset-password");
  });

  afterEach(() => {
    cleanup();
  });

  it("tracks successful password resets", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    const signOut = vi.fn().mockResolvedValue({ error: null });

    createSupabaseBrowserClientMock.mockReturnValue({
      auth: { updateUser, signOut },
    } as never);

    render(<ResetPasswordForm initialCanReset />);

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "SmokePass123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "SmokePass123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save new password" }));

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({
        password: "SmokePass123!",
      });
      expect(signOut).toHaveBeenCalled();
    });
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "password_reset_completed",
      expect.objectContaining({
        route: "reset_password",
        source_surface: "reset_password_form",
        success: true,
      }),
    );
    expect(pushMock).toHaveBeenCalledWith(
      "/?message=Password updated. Sign in with your new password.",
    );
    expect(refreshMock).toHaveBeenCalled();
  });

  it("tracks invalid reset-password sessions", async () => {
    createSupabaseBrowserClientMock.mockReturnValue({
      auth: {
        onAuthStateChange: () => ({
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        }),
      },
    } as never);

    render(<ResetPasswordForm initialCanReset={false} />);

    await waitFor(() => {
      expect(trackAppEventMock).toHaveBeenCalledWith(
        "password_reset_invalid_link",
        expect.objectContaining({
          route: "reset_password",
          source_surface: "reset_password_form",
          success: false,
          error_code: "invalid_recovery_link",
        }),
      );
    });
  });
});
