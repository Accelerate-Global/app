// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { redirect } from "next/navigation";

import { getCurrentIdentity } from "@/lib/auth";
import { getGeneratedIsoCountryCodeResourceWithOverrides } from "@/lib/iso-country-codes";
import type { IsoCountryCodeResource } from "@/lib/iso-country-codes";
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
  getGeneratedIsoCountryCodeResourceWithOverrides: vi.fn(),
}));

vi.mock("@/components/layout/site-header", () => ({
  SiteHeader: () => null,
}));

vi.mock("@/components/dashboard/iso-country-codes-client", () => ({
  IsoCountryCodesClient: isoCountryCodesClientMock,
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const getGeneratedIsoCountryCodeResourceWithOverridesMock = vi.mocked(
  getGeneratedIsoCountryCodeResourceWithOverrides,
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

  it("renders the generated country and territory code resource for authenticated users", async () => {
    const resource = {
      sourceName: "ISO OBP, GENC, legacy FIPS, and curated Accelerate Global overlay",
      sourceUrl: "https://www.iso.org/obp/ui/#search/code/",
      sourceCollectionUrl: "https://www.iso.org/publication/PUB500001.html",
      gencSourceUrl: "https://evs.nci.nih.gov/ftp1/GENC/NCIt-GENC_Terminology.txt",
      gencAboutUrl: "https://evs.nci.nih.gov/ftp1/GENC/About.html",
      fipsSourceUrl: "https://nief.org/attribute-registry/codesets/FIPS10-4CountryCode/",
      fipsWithdrawalUrl:
        "https://csrc.nist.gov/news/2008/announcing-approval-of-the-withdrawal-of-ten-fip-s",
      overlaySourceName: "Accelerate Global - Spec Sheet - ISO3.csv",
      sourceRetrievedAt: "2026-05-06T00:00:00.000Z",
      entryCount: 1,
      officialIsoCount: 1,
      activeCount: 1,
      entries: [
        {
          displayName: "Afghanistan",
          active: true,
          primaryAlpha3: "AFG",
          officialIsoAlpha2: "AF",
          officialIsoAlpha3: "AFG",
          officialIsoNumeric: "004",
          gencAlpha2: "AF",
          gencAlpha3: "AFG",
          gencNumeric: "004",
          fips: "AF",
          alternativeNames: ["Afganistan"],
          classification: "iso-official",
          sourceUri: "iso:code:3166:AF",
        },
      ],
    } satisfies IsoCountryCodeResource;
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "owner-1",
      email: "reader@example.com",
      fullName: "Reader",
      workspaceRole: "pro",
      isDatasetAdmin: false,
      mode: "supabase",
    });
    getGeneratedIsoCountryCodeResourceWithOverridesMock.mockResolvedValue(resource);

    render(await CountryCodesPage());

    expect(screen.getByText("Country & Territory Codes")).toBeTruthy();
    expect(isoCountryCodesClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialResource: resource,
        canRefresh: false,
        canEditAlternativeNames: false,
      }),
      undefined,
    );
  });

  it("passes admin alternate-name editing capability", async () => {
    const resource = {
      sourceName: "ISO OBP, GENC, legacy FIPS, and curated Accelerate Global overlay",
      sourceUrl: "https://www.iso.org/obp/ui/#search/code/",
      sourceCollectionUrl: "https://www.iso.org/publication/PUB500001.html",
      gencSourceUrl: "https://evs.nci.nih.gov/ftp1/GENC/NCIt-GENC_Terminology.txt",
      gencAboutUrl: "https://evs.nci.nih.gov/ftp1/GENC/About.html",
      fipsSourceUrl: "https://nief.org/attribute-registry/codesets/FIPS10-4CountryCode/",
      fipsWithdrawalUrl:
        "https://csrc.nist.gov/news/2008/announcing-approval-of-the-withdrawal-of-ten-fip-s",
      overlaySourceName: "Accelerate Global - Spec Sheet - ISO3.csv",
      sourceRetrievedAt: "2026-05-06T00:00:00.000Z",
      entryCount: 0,
      officialIsoCount: 1,
      activeCount: 0,
      entries: [],
    } satisfies IsoCountryCodeResource;
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "owner-1",
      email: "admin@example.com",
      fullName: "Admin",
      workspaceRole: "admin",
      isDatasetAdmin: true,
      mode: "supabase",
    });
    getGeneratedIsoCountryCodeResourceWithOverridesMock.mockResolvedValue(resource);

    render(await CountryCodesPage());

    expect(isoCountryCodesClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialResource: resource,
        canRefresh: true,
        canEditAlternativeNames: true,
      }),
      undefined,
    );
  });
});
