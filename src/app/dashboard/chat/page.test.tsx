// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { redirect } from "next/navigation";

import { getCurrentIdentity } from "@/lib/auth";
import PrivateDataChatPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));
vi.mock("@/lib/auth", () => ({ getCurrentIdentity: vi.fn() }));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const redirectMock = vi.mocked(redirect);
const originalEnvironment = { ...process.env };

describe("/dashboard/chat", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnvironment };
    process.env.PRIVATE_DATA_CHAT_CANARY_EMAILS = "admin@example.com";
  });

  it("redirects anonymous and non-admin users", async () => {
    getCurrentIdentityMock.mockResolvedValueOnce(null);
    await expect(PrivateDataChatPage()).rejects.toThrow("NEXT_REDIRECT:/");

    getCurrentIdentityMock.mockResolvedValueOnce({
      ownerId: "pro-1",
      email: "pro@example.com",
      fullName: null,
      workspaceRole: "pro",
      isDatasetAdmin: false,
      mode: "supabase",
    });
    await expect(PrivateDataChatPage()).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard",
    );
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("renders a disabled-first admin pilot page", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "admin-1",
      email: "admin@example.com",
      fullName: null,
      workspaceRole: "admin",
      isDatasetAdmin: true,
      mode: "supabase",
    });
    const view = await PrivateDataChatPage();
    render(view);

    expect(screen.getByRole("heading", { name: "Private data chat" })).toBeTruthy();
    expect(
      screen.getByText("Private data chat is not configured"),
    ).toBeTruthy();
  });

  it("redirects an administrator outside the exact canary allowlist", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "admin-2",
      email: "other-admin@example.com",
      fullName: null,
      workspaceRole: "admin",
      isDatasetAdmin: true,
      mode: "supabase",
    });

    await expect(PrivateDataChatPage()).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard",
    );
  });
});
