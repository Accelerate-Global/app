// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { ForgotPasswordForm } from "./forgot-password-form";

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: vi.fn(),
}));

const createSupabaseBrowserClientMock = vi.mocked(createSupabaseBrowserClient);

describe("ForgotPasswordForm", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows a success state without surfacing a false failure", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });

    createSupabaseBrowserClientMock.mockReturnValue({
      auth: { resetPasswordForEmail },
    } as never);

    render(<ForgotPasswordForm />);

    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;

    fireEvent.change(emailInput, {
      target: { value: "admin@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(resetPasswordForEmail).toHaveBeenCalledWith(
        "admin@example.com",
        expect.objectContaining({
          redirectTo: expect.stringContaining(
            "/auth/confirm?next=/reset-password",
          ),
        }),
      );
    });

    expect(
      await screen.findByText(
        "If an account exists for that email, a password reset link is on its way.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/password reset failed/i)).toBeNull();
    expect(emailInput.value).toBe("");
  });

  it("shows the Supabase error when the reset request fails", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({
      error: { message: "SMTP is unavailable." },
    });

    createSupabaseBrowserClientMock.mockReturnValue({
      auth: { resetPasswordForEmail },
    } as never);

    render(<ForgotPasswordForm />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "admin@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(await screen.findByText("SMTP is unavailable.")).toBeTruthy();
    expect(screen.queryByText(/check your inbox/i)).toBeNull();
  });
});
