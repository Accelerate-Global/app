// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { AuthForm } from "./auth-form";

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

describe("AuthForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
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

    render(<AuthForm />);

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
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("explains that account access comes from an administrator invitation", () => {
    createSupabaseBrowserClientMock.mockReturnValue({
      auth: { signInWithPassword: vi.fn() },
    } as never);

    render(<AuthForm />);

    expect(
      screen.getByText(
        "Need an account? Ask a workspace administrator to send you an invitation.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Sign up" })).toBeNull();
  });
});
