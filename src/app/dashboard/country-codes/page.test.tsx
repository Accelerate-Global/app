// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { redirect } from "next/navigation";

import { getCurrentIdentity } from "@/lib/auth";
import { getGeneratedIsoCountryCodeResource } from "@/lib/iso-country-codes";
import CountryCodesPage from "./page";

const { isoCountryCodesClientMock } = vi.hoisted(() => ({
  isoCountryCodesClientMock: vi.fn(() => null),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/iso-country-codes", () => ({
  getGeneratedIsoCountryCodeResource: vi.fn(),
}));

vi.mock("@/components/layout/site-header", () => ({
  SiteHeader: () => null,
}));

vi.mock("@/components/dashboard/iso-country-codes-client", () => ({
  IsoCountryCodesClient: isoCountryCodesClientMock,
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const getGeneratedIsoCountryCodeResourceMock = vi.mocked(
  getGeneratedIsoCountryCodeResource,
);
const redirectMock = vi.mocked(redirect);

describe("/dashboard/country-codes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("redirects anonymous users home", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    await expect(CountryCodesPage()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("renders the generated ISO country-code resource for authenticated users", async () => {
    const resource = {
      sourceName: "ISO Online Browsing Platform",
      sourceUrl: "https://www.iso.org/obp/ui/#search/code/",
      sourceCollectionUrl: "https://www.iso.org/publication/PUB500001.html",
      sourceRetrievedAt: "2026-05-06T00:00:00.000Z",
      entryCount: 1,
      entries: [
        {
          alpha2: "AF",
          alpha3: "AFG",
          englishShortName: "Afghanistan",
          numeric: "004",
          uri: "iso:code:3166:AF",
        },
      ],
    };
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "owner-1",
      email: "reader@example.com",
      fullName: "Reader",
      workspaceRole: "pro",
      isDatasetAdmin: false,
      mode: "supabase",
    });
    getGeneratedIsoCountryCodeResourceMock.mockReturnValue(resource);

    render(await CountryCodesPage());

    expect(screen.getByText("ISO3 Country Codes")).toBeTruthy();
    expect(isoCountryCodesClientMock).toHaveBeenCalledWith(
      expect.objectContaining({ initialResource: resource }),
      undefined,
    );
  });
});
