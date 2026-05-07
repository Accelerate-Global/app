import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { updateIsoCountryCodeAlternativeNames } from "@/lib/iso-country-codes";
import type {
  IsoCountryCodeEntry,
  IsoCountryCodeResource,
} from "@/lib/iso-country-codes";
import { PATCH } from "./route";

vi.mock("@/lib/auth", () => ({
  getCurrentIdentity: vi.fn(),
}));

vi.mock("@/lib/error-logging", () => ({
  logError: vi.fn(),
}));

vi.mock("@/lib/iso-country-codes", () => ({
  updateIsoCountryCodeAlternativeNames: vi.fn(),
}));

const getCurrentIdentityMock = vi.mocked(getCurrentIdentity);
const updateIsoCountryCodeAlternativeNamesMock = vi.mocked(
  updateIsoCountryCodeAlternativeNames,
);

const entry: IsoCountryCodeEntry = {
  displayName: "Afghanistan",
  active: true,
  primaryAlpha3: "AFG",
  officialIsoAlpha2: "AF",
  officialIsoAlpha3: "AFG",
  officialIsoNumeric: "004",
  untermEnglishShortName: "Afghanistan",
  untermEnglishFormalName: "the Islamic Republic of Afghanistan",
  untermNameSource: "unterm-m49",
  gencAlpha2: "AF",
  gencAlpha3: "AFG",
  gencNumeric: "004",
  fips: "AF",
  alternativeNames: ["Afganistan"],
  classification: "iso-official",
  sourceUri: "iso:code:3166:AF",
};

const resource: IsoCountryCodeResource = {
  sourceName:
    "ISO OBP, UNTERM, UNSD M49, GENC, legacy FIPS, and curated Accelerate Global overlay",
  sourceUrl: "https://www.iso.org/obp/ui/#search/code/",
  sourceCollectionUrl: "https://www.iso.org/publication/PUB500001.html",
  gencSourceUrl: "https://evs.nci.nih.gov/ftp1/GENC/NCIt-GENC_Terminology.txt",
  gencAboutUrl: "https://evs.nci.nih.gov/ftp1/GENC/About.html",
  fipsSourceUrl: "https://nief.org/attribute-registry/codesets/FIPS10-4CountryCode/",
  fipsWithdrawalUrl:
    "https://csrc.nist.gov/news/2008/announcing-approval-of-the-withdrawal-of-ten-fip-s",
  untermSourceUrl: "https://conferences.unite.un.org/untermapi/api/term/downloadCountries",
  m49SourceUrl: "https://unstats.un.org/unsd/methodology/m49/overview/",
  overlaySourceName: "Accelerate Global - Spec Sheet - ISO3.csv",
  sourceRetrievedAt: "2026-05-06T00:00:00.000Z",
  entryCount: 1,
  officialIsoCount: 1,
  activeCount: 1,
  entries: [entry],
};

function buildRequest(payload: unknown) {
  return new Request("https://example.test/api/iso-country-codes/alternative-names", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

describe("/api/iso-country-codes/alternative-names", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects anonymous alternate-name updates", async () => {
    getCurrentIdentityMock.mockResolvedValue(null);

    const response = await PATCH(
      buildRequest({ displayName: "Afghanistan", alternativeNames: [] }),
    );

    expect(response.status).toBe(401);
    expect(updateIsoCountryCodeAlternativeNamesMock).not.toHaveBeenCalled();
  });

  it("rejects non-admin alternate-name updates", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "owner-1",
      email: "reader@example.com",
      fullName: null,
      workspaceRole: "basic",
      isDatasetAdmin: false,
      mode: "supabase",
    });

    const response = await PATCH(
      buildRequest({ displayName: "Afghanistan", alternativeNames: [] }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Only admins can manage country and territory alternate names.",
    });
    expect(updateIsoCountryCodeAlternativeNamesMock).not.toHaveBeenCalled();
  });

  it("updates alternate names for admins", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "admin-1",
      email: "admin@example.com",
      fullName: null,
      workspaceRole: "admin",
      isDatasetAdmin: true,
      mode: "supabase",
    });
    updateIsoCountryCodeAlternativeNamesMock.mockResolvedValue({
      entry,
      resource,
    });

    const response = await PATCH(
      buildRequest({
        displayName: "Afghanistan",
        alternativeNames: ["Afganistan"],
      }),
    );

    expect(response.status).toBe(200);
    expect(updateIsoCountryCodeAlternativeNamesMock).toHaveBeenCalledWith({
      displayName: "Afghanistan",
      alternativeNames: ["Afganistan"],
      updatedByOwnerId: "admin-1",
    });
    await expect(response.json()).resolves.toEqual({ entry, resource });
  });

  it("rejects invalid alternate-name payloads", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "admin-1",
      email: "admin@example.com",
      fullName: null,
      workspaceRole: "admin",
      isDatasetAdmin: true,
      mode: "supabase",
    });

    const response = await PATCH(buildRequest({ displayName: "" }));

    expect(response.status).toBe(400);
    expect(updateIsoCountryCodeAlternativeNamesMock).not.toHaveBeenCalled();
  });
});
