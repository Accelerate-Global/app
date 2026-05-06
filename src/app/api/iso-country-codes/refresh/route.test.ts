import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { refreshIsoCountryCodeResourceFromOfficialSource } from "@/lib/iso-country-codes";
import type { IsoCountryCodeResource } from "@/lib/iso-country-codes";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/error-logging", () => ({
  logError: vi.fn(),
}));

vi.mock("@/lib/iso-country-codes", () => ({
  refreshIsoCountryCodeResourceFromOfficialSource: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const refreshIsoCountryCodeResourceFromOfficialSourceMock = vi.mocked(
  refreshIsoCountryCodeResourceFromOfficialSource,
);

describe("/api/iso-country-codes/refresh", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects anonymous refresh requests", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(refreshIsoCountryCodeResourceFromOfficialSourceMock).not.toHaveBeenCalled();
  });

  it("rejects non-admin refresh requests", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "owner-1",
      email: "reader@example.com",
      fullName: null,
      workspaceRole: "basic",
      isDatasetAdmin: false,
      mode: "supabase",
    });

    const response = await GET();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Only admins can refresh country and territory codes.",
    });
    expect(refreshIsoCountryCodeResourceFromOfficialSourceMock).not.toHaveBeenCalled();
  });

  it("returns live country and territory code resource for admins", async () => {
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
      email: "admin@example.com",
      fullName: null,
      workspaceRole: "admin",
      isDatasetAdmin: true,
      mode: "supabase",
    });
    refreshIsoCountryCodeResourceFromOfficialSourceMock.mockResolvedValue(resource);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(resource);
  });

  it("returns a gateway error when source refresh fails", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "owner-1",
      email: "admin@example.com",
      fullName: null,
      workspaceRole: "admin",
      isDatasetAdmin: true,
      mode: "supabase",
    });
    refreshIsoCountryCodeResourceFromOfficialSourceMock.mockRejectedValue(
      new Error("ISO unavailable"),
    );

    const response = await GET();

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Could not refresh country and territory codes.",
    });
  });
});
