// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { redirect } from "next/navigation";

import { getCurrentIdentity } from "@/lib/auth";
import { listFilterRegions, listRegionCountryOptions } from "@/lib/filter-settings";
import FilterSettingsPage from "./page";

const { filterSettingsClientMock } = vi.hoisted(() => ({
  filterSettingsClientMock: vi.fn(() => null),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/filter-settings", () => ({
  listFilterRegions: vi.fn(),
  listRegionCountryOptions: vi.fn(),
}));

vi.mock("@/components/layout/site-header", () => ({
  SiteHeader: () => null,
}));

vi.mock("@/components/dashboard/filter-settings-client", () => ({
  FilterSettingsClient: filterSettingsClientMock,
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const listFilterRegionsMock = vi.mocked(listFilterRegions);
const listRegionCountryOptionsMock = vi.mocked(listRegionCountryOptions);
const redirectMock = vi.mocked(redirect);

describe("/dashboard/filter-settings", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("redirects anonymous users home", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    await expect(FilterSettingsPage()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("redirects non-admin users back to the dashboard", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "owner-1",
      email: "viewer@example.com",
      fullName: null,
      isDatasetAdmin: false,
      mode: "supabase",
    });

    await expect(FilterSettingsPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("renders for admins", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "owner-1",
      email: "admin@example.com",
      fullName: "Blake Lewis",
      isDatasetAdmin: true,
      mode: "supabase",
    });
    listFilterRegionsMock.mockResolvedValue([]);
    listRegionCountryOptionsMock.mockResolvedValue(["India", "Nepal"]);

    render(await FilterSettingsPage());

    expect(listFilterRegionsMock).toHaveBeenCalledWith();
    expect(listRegionCountryOptionsMock).toHaveBeenCalledWith();
    expect(filterSettingsClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorOwnerId: "owner-1",
        workspaceRole: "admin",
      }),
      undefined,
    );
  });
});
