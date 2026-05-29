// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { redirect } from "next/navigation";

import { getCurrentIdentity } from "@/lib/auth";
import DashboardLayout from "./layout";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/components/layout/site-header", () => ({
  SiteHeader: ({ identity }: { identity: { email: string | null } }) => (
    <header data-testid="site-header">{identity.email}</header>
  ),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const redirectMock = vi.mocked(redirect);

describe("DashboardLayout", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("redirects anonymous dashboard requests home", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    await expect(
      DashboardLayout({ children: <div>Dashboard child</div> }),
    ).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("renders the shared dashboard header around child pages", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "owner-1",
      email: "admin@example.com",
      fullName: "Admin",
      workspaceRole: "admin",
      isDatasetAdmin: true,
      mode: "supabase",
    });

    render(await DashboardLayout({ children: <div>Dashboard child</div> }));

    expect(screen.getByTestId("site-header").textContent).toBe("admin@example.com");
    expect(screen.getByText("Dashboard child")).toBeTruthy();
    expect(document.querySelector("main.min-h-svh.bg-background")).toBeTruthy();
  });
});
