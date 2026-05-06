import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentIdentity } from "@/lib/auth";
import { refreshIsoCountryCodeResourceFromOfficialSource } from "@/lib/iso-country-codes";
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

  it("returns live ISO country-code resource for authenticated users", async () => {
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
      fullName: null,
      workspaceRole: "basic",
      isDatasetAdmin: false,
      mode: "supabase",
    });
    refreshIsoCountryCodeResourceFromOfficialSourceMock.mockResolvedValue(resource);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(resource);
  });

  it("returns a gateway error when ISO refresh fails", async () => {
    getCurrentIdentityMock.mockResolvedValue({
      ownerId: "owner-1",
      email: "reader@example.com",
      fullName: null,
      workspaceRole: "basic",
      isDatasetAdmin: false,
      mode: "supabase",
    });
    refreshIsoCountryCodeResourceFromOfficialSourceMock.mockRejectedValue(
      new Error("ISO unavailable"),
    );

    const response = await GET();

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Could not refresh ISO country codes from ISO.",
    });
  });
});
