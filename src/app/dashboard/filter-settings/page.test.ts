import { beforeEach, describe, expect, it, vi } from "vitest";

import { redirect } from "next/navigation";

import { getCurrentIdentity } from "@/lib/auth";
import { listFilterRegions, listRegionCountryOptions } from "@/lib/filter-settings";
import FilterSettingsPage from "./page";

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
  FilterSettingsClient: () => null,
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

    const view = await FilterSettingsPage();

    expect(view).toBeTruthy();
    expect(listFilterRegionsMock).toHaveBeenCalledWith();
    expect(listRegionCountryOptionsMock).toHaveBeenCalledWith();
  });
});
