// @vitest-environment jsdom

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IsoCountryCodesClient } from "./iso-country-codes-client";
import type { IsoCountryCodeResource } from "@/lib/iso-country-codes";

const fetchMock = vi.fn();
const writeTextMock = vi.fn();

const initialResource: IsoCountryCodeResource = {
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
  entryCount: 3,
  officialIsoCount: 1,
  activeCount: 2,
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
      alternativeNames: ["Afganistan", "Islamic Republic of Afghanistan"],
      classification: "iso-official",
      sourceUri: "iso:code:3166:AF",
    },
    {
      displayName: "Akrotiri",
      active: false,
      primaryAlpha3: null,
      officialIsoAlpha2: null,
      officialIsoAlpha3: null,
      officialIsoNumeric: null,
      gencAlpha2: "QZ",
      gencAlpha3: "XQZ",
      gencNumeric: "900",
      fips: "AX",
      alternativeNames: [],
      classification: "genc-supported",
      sourceUri: null,
    },
    {
      displayName: "Baker Island",
      active: true,
      primaryAlpha3: "UMI",
      officialIsoAlpha2: "UM",
      officialIsoAlpha3: "UMI",
      officialIsoNumeric: "581",
      gencAlpha2: "XB",
      gencAlpha3: "XBK",
      gencNumeric: "903",
      fips: "FQ",
      alternativeNames: ["United States Minor Outlying Islands (the)"],
      classification: "duplicate-iso-territory",
      sourceUri: "iso:code:3166:UM",
    },
  ],
};

function buildJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("IsoCountryCodesClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders compact columns and filters by hidden detail fields", () => {
    render(<IsoCountryCodesClient initialResource={initialResource} />);

    expect(screen.getByRole("columnheader", { name: "Country/Territory" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "ISO3" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "FIPS" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "GENC3" })).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "ISO2" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Numeric" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Alternative Names" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Classification" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Copy" })).toBeNull();
    expect(screen.queryByText(/curated rows/)).toBeNull();
    expect(screen.getByText("Afghanistan")).toBeTruthy();
    expect(screen.getByText("Akrotiri")).toBeTruthy();
    expect(screen.getByText("Baker Island")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/Search name/), {
      target: { value: "Afganistan" },
    });

    expect(screen.getByText("Afghanistan")).toBeTruthy();
    expect(screen.queryByText("Akrotiri")).toBeNull();

    fireEvent.change(screen.getByPlaceholderText(/Search name/), {
      target: { value: "AX" },
    });

    expect(screen.getByText("Akrotiri")).toBeTruthy();
    expect(screen.queryByText("Afghanistan")).toBeNull();

    fireEvent.change(screen.getByPlaceholderText(/Search name/), {
      target: { value: "Duplicate ISO territory" },
    });

    expect(screen.getByText("Baker Island")).toBeTruthy();
    expect(screen.getByText("1 visible")).toBeTruthy();
  });

  it("opens a right-side detail sheet with hidden fields and smoke markers", () => {
    render(<IsoCountryCodesClient initialResource={initialResource} />);

    fireEvent.click(screen.getByText("Afghanistan"));

    expect(screen.getByText("Primary ISO3")).toBeTruthy();
    expect(screen.getByText("ISO2")).toBeTruthy();
    expect(screen.getByText("Numeric")).toBeTruthy();
    expect(screen.getByText("Classification")).toBeTruthy();
    expect(screen.getByText("Source URI")).toBeTruthy();
    expect(screen.getByText("Afganistan")).toBeTruthy();
    expect(screen.getByText("Islamic Republic of Afghanistan")).toBeTruthy();
    expect(screen.getAllByText("004").length).toBeGreaterThan(0);
    expect(screen.getByText("ISO official")).toBeTruthy();
    expect(
      document.querySelector('[data-smoke-ready="country-code-detail-sheet"]'),
    ).toBeTruthy();
  });

  it("copies primary, fallback GENC, and FIPS codes from the detail sheet", async () => {
    writeTextMock.mockResolvedValue(undefined);
    render(<IsoCountryCodesClient initialResource={initialResource} />);

    fireEvent.click(screen.getByText("Afghanistan"));
    fireEvent.click(screen.getByRole("button", { name: "Copy primary code AFG" }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("AFG");
    });
    expect(screen.getByText("Copied AFG")).toBeTruthy();

    fireEvent.click(screen.getByText("Akrotiri"));
    fireEvent.click(screen.getByRole("button", { name: "Copy primary code XQZ" }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("XQZ");
    });

    fireEvent.click(screen.getByRole("button", { name: "Copy FIPS AX" }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("AX");
    });
    expect(screen.getByText("Copied FIPS AX")).toBeTruthy();
  });

  it("updates status and alternative names for the current session", () => {
    render(<IsoCountryCodesClient initialResource={initialResource} />);

    const afghanistanRow = screen.getByText("Afghanistan").closest("tr");
    expect(afghanistanRow).toBeTruthy();
    expect(within(afghanistanRow!).getByText("Active")).toBeTruthy();

    fireEvent.click(screen.getByText("Afghanistan"));
    fireEvent.click(
      screen.getByRole("switch", { name: "Set Afghanistan active status" }),
    );

    expect(within(afghanistanRow!).getByText("Inactive")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Alternative name"), {
      target: { value: "Afghan Republic" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByText("Afghan Republic")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/Search name/), {
      target: { value: "Afghan Republic" },
    });

    expect(screen.getAllByText("Afghanistan").length).toBeGreaterThan(0);
    expect(screen.getByText("1 visible")).toBeTruthy();
  });

  it("refreshes visible entries from the authenticated API", async () => {
    const refreshedResource: IsoCountryCodeResource = {
      ...initialResource,
      entryCount: 1,
      activeCount: 1,
      entries: [
        {
          displayName: "Zimbabwe",
          active: true,
          primaryAlpha3: "ZWE",
          officialIsoAlpha2: "ZW",
          officialIsoAlpha3: "ZWE",
          officialIsoNumeric: "716",
          gencAlpha2: "ZW",
          gencAlpha3: "ZWE",
          gencNumeric: "716",
          fips: "ZI",
          alternativeNames: ["Zimbawe"],
          classification: "iso-official",
          sourceUri: "iso:code:3166:ZW",
        },
      ],
    };
    fetchMock.mockResolvedValue(buildJsonResponse(refreshedResource));
    render(<IsoCountryCodesClient initialResource={initialResource} />);

    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/iso-country-codes/refresh");
    });
    expect(await screen.findByText("Zimbabwe")).toBeTruthy();
    expect(screen.queryByText("Afghanistan")).toBeNull();
  });

  it("keeps generated entries visible when refresh fails", async () => {
    fetchMock.mockResolvedValue(buildJsonResponse({ error: "Nope" }, 502));
    render(<IsoCountryCodesClient initialResource={initialResource} />);

    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));

    expect(await screen.findByText(/Could not refresh country and territory/)).toBeTruthy();
    expect(screen.getByText("Afghanistan")).toBeTruthy();
  });
});
