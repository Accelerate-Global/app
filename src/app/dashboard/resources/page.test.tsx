// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { redirect } from "next/navigation";

import { getCurrentIdentity } from "@/lib/auth";
import ResourcesPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/components/layout/site-header", () => ({
  SiteHeader: () => null,
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const redirectMock = vi.mocked(redirect);

describe("/dashboard/resources", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("redirects anonymous users home", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    await expect(ResourcesPage()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("renders built-in resources for authenticated non-admin users", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "owner-1",
      email: "reader@example.com",
      fullName: "Reader",
      workspaceRole: "basic",
      isDatasetAdmin: false,
      mode: "supabase",
    });

    render(await ResourcesPage());

    expect(screen.getByText("Resources")).toBeTruthy();
    expect(screen.getByText("Country & territory code resource")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Open resource" }).getAttribute("href"),
    ).toBe("/dashboard/country-codes");
    expect(document.querySelector('[data-smoke-page="resources"]')).toBeTruthy();
  });
});
