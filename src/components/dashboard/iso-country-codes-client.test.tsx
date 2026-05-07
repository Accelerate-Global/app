// @vitest-environment jsdom

import {
  cleanup,
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
const createObjectUrlMock = vi.fn((_value: Blob | MediaSource) => {
  void _value;
  return "blob:country-codes";
});
const revokeObjectUrlMock = vi.fn();

const initialResource: IsoCountryCodeResource = {
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
      untermEnglishShortName: "Afghanistan",
      untermEnglishFormalName: "the Islamic Republic of Afghanistan",
      untermNameSource: "unterm-m49",
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
      untermEnglishShortName: null,
      untermEnglishFormalName: null,
      untermNameSource: null,
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
      untermEnglishShortName: null,
      untermEnglishFormalName: null,
      untermNameSource: null,
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
    createObjectUrlMock.mockReturnValue("blob:country-codes");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrlMock,
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders compact columns and filters by hidden detail fields", () => {
    render(
      <IsoCountryCodesClient
        initialResource={initialResource}
        canRefresh
        canEditAlternativeNames
      />,
    );

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
    expect(screen.queryByText("1 visible")).toBeNull();
    expect(screen.queryByText("3 visible")).toBeNull();

    fireEvent.change(screen.getByPlaceholderText(/Search name/), {
      target: { value: "Islamic Republic" },
    });

    expect(screen.getByText("Afghanistan")).toBeTruthy();
    expect(screen.queryByText("Baker Island")).toBeNull();
  });

  it("opens a right-side detail sheet with hidden fields and smoke markers", () => {
    render(
      <IsoCountryCodesClient
        initialResource={initialResource}
        canRefresh
        canEditAlternativeNames
      />,
    );

    fireEvent.click(screen.getByText("Afghanistan"));

    expect(screen.getByText("Primary ISO3")).toBeTruthy();
    expect(screen.getByText("ISO2")).toBeTruthy();
    expect(screen.getByText("Numeric")).toBeTruthy();
    expect(screen.getByText("Classification")).toBeTruthy();
    expect(screen.getByText("Official UN Names")).toBeTruthy();
    expect(screen.getByText("Official UN short name")).toBeTruthy();
    expect(screen.getByText("Official UN formal name")).toBeTruthy();
    expect(screen.getByText("the Islamic Republic of Afghanistan")).toBeTruthy();
    expect(screen.getByText("unterm-m49")).toBeTruthy();
    expect(screen.getByText("Source URI")).toBeTruthy();
    expect(screen.getByText("Afganistan")).toBeTruthy();
    expect(screen.getByText("Islamic Republic of Afghanistan")).toBeTruthy();
    expect(screen.getAllByText("004").length).toBeGreaterThan(0);
    expect(screen.getByText("ISO official")).toBeTruthy();
    expect(screen.queryByText("AFG / FIPS AF")).toBeNull();
    expect(screen.queryByRole("button", { name: /Copy/ })).toBeNull();
    expect(
      document.querySelector('[data-smoke-ready="country-code-detail-sheet"]'),
    ).toBeTruthy();
  });

  it("keeps alternate names read-only for non-admin users", () => {
    render(
      <IsoCountryCodesClient
        initialResource={initialResource}
        canRefresh={false}
        canEditAlternativeNames={false}
      />,
    );

    fireEvent.click(screen.getByText("Afghanistan"));

    expect(screen.getByText("Afganistan")).toBeTruthy();
    expect(screen.queryByLabelText("Alternative name")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Delete alternate name Afganistan" }),
    ).toBeNull();
  });

  it("updates status for the current session", () => {
    render(
      <IsoCountryCodesClient
        initialResource={initialResource}
        canRefresh
        canEditAlternativeNames
      />,
    );

    const afghanistanRow = screen.getByText("Afghanistan").closest("tr");
    expect(afghanistanRow).toBeTruthy();
    expect(within(afghanistanRow!).getByText("Active")).toBeTruthy();

    fireEvent.click(screen.getByText("Afghanistan"));
    fireEvent.click(
      screen.getByRole("switch", { name: "Set Afghanistan active status" }),
    );

    expect(within(afghanistanRow!).getByText("Inactive")).toBeTruthy();
  });

  it("persists alternate name additions and deletions for admins", async () => {
    const addedEntry = {
      ...initialResource.entries[0],
      alternativeNames: [
        ...initialResource.entries[0].alternativeNames,
        "Afghan Republic",
      ],
    };
    const addedResource = {
      ...initialResource,
      entries: [addedEntry, ...initialResource.entries.slice(1)],
    };
    const deletedEntry = {
      ...addedEntry,
      alternativeNames: ["Islamic Republic of Afghanistan", "Afghan Republic"],
    };
    const deletedResource = {
      ...initialResource,
      entries: [deletedEntry, ...initialResource.entries.slice(1)],
    };
    fetchMock
      .mockResolvedValueOnce(
        buildJsonResponse({ entry: addedEntry, resource: addedResource }),
      )
      .mockResolvedValueOnce(
        buildJsonResponse({ entry: deletedEntry, resource: deletedResource }),
      );
    render(
      <IsoCountryCodesClient
        initialResource={initialResource}
        canRefresh
        canEditAlternativeNames
      />,
    );

    fireEvent.click(screen.getByText("Afghanistan"));
    fireEvent.change(screen.getByLabelText("Alternative name"), {
      target: { value: "Afghan Republic" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/iso-country-codes/alternative-names",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            displayName: "Afghanistan",
            alternativeNames: [
              "Afganistan",
              "Islamic Republic of Afghanistan",
              "Afghan Republic",
            ],
          }),
        }),
      );
    });
    expect(await screen.findByText("Afghan Republic")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/Search name/), {
      target: { value: "Afghan Republic" },
    });

    expect(screen.getAllByText("Afghanistan").length).toBeGreaterThan(0);
    expect(screen.queryByText("1 visible")).toBeNull();

    fireEvent.change(screen.getByPlaceholderText(/Search name/), {
      target: { value: "" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Delete alternate name Afganistan" }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/iso-country-codes/alternative-names",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            displayName: "Afghanistan",
            alternativeNames: [
              "Islamic Republic of Afghanistan",
              "Afghan Republic",
            ],
          }),
        }),
      );
    });
    expect(screen.queryByText("Afganistan")).toBeNull();
  });

  it("downloads the current visible resource rows as CSV", async () => {
    render(
      <IsoCountryCodesClient
        initialResource={initialResource}
        canRefresh={false}
        canEditAlternativeNames={false}
      />,
    );

    expect(screen.queryByRole("button", { name: /Refresh/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "JSON" })).toBeNull();

    fireEvent.change(screen.getByPlaceholderText(/Search name/), {
      target: { value: "Afganistan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
    const blob = createObjectUrlMock.mock.calls[0]?.[0] as Blob;
    const csv = await blob.text();

    expect(blob.type).toBe("text/csv;charset=utf-8");
    expect(csv).toContain(
      "Country/Territory,Status,ISO3,ISO2,Numeric,Official UN short name,Official UN formal name,Official name source,FIPS,GENC3,GENC2,GENC numeric,Classification,Alternative names,Source URI",
    );
    expect(csv).toContain(
      "Afghanistan,Active,AFG,AF,004,Afghanistan,the Islamic Republic of Afghanistan,unterm-m49,AF,AFG,AF,004,ISO official,Afganistan; Islamic Republic of Afghanistan,iso:code:3166:AF",
    );
    expect(csv).not.toContain("Akrotiri");
    expect(revokeObjectUrlMock).toHaveBeenCalledWith("blob:country-codes");
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
          untermEnglishShortName: "Zimbabwe",
          untermEnglishFormalName: "the Republic of Zimbabwe",
          untermNameSource: "unterm-m49",
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
    render(
      <IsoCountryCodesClient
        initialResource={initialResource}
        canRefresh
        canEditAlternativeNames
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/iso-country-codes/refresh");
    });
    expect(await screen.findByText("Zimbabwe")).toBeTruthy();
    expect(screen.queryByText("Refresh source data")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Refresh" }).querySelector(".text-emerald-600"),
    ).toBeTruthy();
    expect(screen.queryByText("Afghanistan")).toBeNull();
  });

  it("keeps generated entries visible when refresh fails", async () => {
    fetchMock.mockResolvedValue(buildJsonResponse({ error: "Nope" }, 502));
    render(
      <IsoCountryCodesClient
        initialResource={initialResource}
        canRefresh
        canEditAlternativeNames
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));

    expect(await screen.findByText(/Could not refresh country and territory/)).toBeTruthy();
    expect(screen.queryByText("Refresh source data")).toBeNull();
    expect(screen.getByText("Afghanistan")).toBeTruthy();
  });
});
