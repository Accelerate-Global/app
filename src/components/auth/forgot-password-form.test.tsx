// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { ForgotPasswordForm } from "./forgot-password-form";

const { trackAppEventMock } = vi.hoisted(() => ({
  trackAppEventMock: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: vi.fn(),
}));

vi.mock("@/lib/analytics-client", () => ({
  trackAppEvent: trackAppEventMock,
}));

const createSupabaseBrowserClientMock = vi.mocked(createSupabaseBrowserClient);

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("tracks password reset requests without sending the email", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({
      error: null,
    });

    createSupabaseBrowserClientMock.mockReturnValue({
      auth: { resetPasswordForEmail },
    } as never);

    render(<ForgotPasswordForm />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "viewer@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => {
      expect(resetPasswordForEmail).toHaveBeenCalledWith(
        "viewer@example.com",
        expect.objectContaining({
          redirectTo: expect.stringContaining(
            "/auth/confirm?next=%2Freset-password",
          ),
        }),
      );
    });
    expect(trackAppEventMock).toHaveBeenCalledWith(
      "password_reset_requested",
      expect.objectContaining({
        route: "forgot_password",
        source_surface: "forgot_password_form",
        success: true,
      }),
    );
  });

  it("tracks invalid recovery link messages", () => {
    createSupabaseBrowserClientMock.mockReturnValue({
      auth: {},
    } as never);

    render(
      <ForgotPasswordForm message="Recovery link could not be verified." />,
    );

    expect(trackAppEventMock).toHaveBeenCalledWith(
      "password_reset_invalid_link",
      expect.objectContaining({
        route: "forgot_password",
        source_surface: "forgot_password_message",
        success: false,
        error_code: "invalid_recovery_link",
      }),
    );
  });
});
