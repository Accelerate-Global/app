// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { redirect } from "next/navigation";

import { getCurrentIdentity } from "@/lib/auth";
import DataLakePage from "./page";

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

describe("/dashboard/data-lake", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("redirects anonymous users home", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    await expect(DataLakePage()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("renders the shared source catalog for authenticated viewers", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "viewer-1",
      email: "viewer@example.com",
      fullName: null,
      isDatasetAdmin: false,
      mode: "supabase",
    });

    render(await DataLakePage());

    expect(screen.getByRole("heading", { name: "Field Sources" })).toBeTruthy();
    expect(
      screen.getByText(
        "Field Sources gives the workspace a dedicated home for understanding where shared field data originates and how those source relationships are managed.",
      ),
    ).toBeTruthy();
  });

  it("renders the same simplified page for dataset admins", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "admin-1",
      email: "admin@example.com",
      fullName: "Admin User",
      isDatasetAdmin: true,
      mode: "supabase",
    });

    render(await DataLakePage());

    expect(screen.getByRole("heading", { name: "Field Sources" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Back to dashboard" }),
    ).toBeTruthy();
  });
});
