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

    expect(document.querySelector(".max-w-7xl")).toBeTruthy();
    expect(document.querySelector(".sm\\:grid-cols-2")).toBeTruthy();
    expect(screen.getByText("Resources")).toBeTruthy();
    expect(screen.getByText("Country & territory code resource")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /Country & territory code resource/ })
        .getAttribute("href"),
    ).toBe("/dashboard/country-codes");
    expect(screen.getByText("ROP Codes resource")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /ROP Codes resource/ }).getAttribute("href"),
    ).toBe("/dashboard/rop-codes");
    expect(screen.queryByText("Open resource")).toBeNull();
    expect(document.querySelector('[data-smoke-page="resources"]')).toBeTruthy();
  });
});
