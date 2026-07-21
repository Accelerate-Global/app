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
    "ISO OBP, UNTERM, UNSD M49, GENC, legacy FIPS, ROG3/GEC crosswalk, and curated Accelerate Global overlay",
  sourceUrl: "https://www.iso.org/obp/ui/#search/code/",
  sourceCollectionUrl: "https://www.iso.org/publication/PUB500001.html",
  gencSourceUrl: "https://evs.nci.nih.gov/ftp1/GENC/NCIt-GENC_Terminology.txt",
  gencAboutUrl: "https://evs.nci.nih.gov/ftp1/GENC/About.html",
  fipsSourceUrl: "https://nief.org/attribute-registry/codesets/FIPS10-4CountryCode/",
  fipsWithdrawalUrl:
    "https://csrc.nist.gov/news/2008/announcing-approval-of-the-withdrawal-of-ten-fip-s",
  rog3SourceUrl:
    "https://geonames.nga.mil/geonames/GNSSearch/GNSDocs/xlsdocs/GENC_ED3U24_GEC_XWALK.xlsx",
  rog3HisRegistryUrl: "https://hisregistries.org/rog/",
  rog3HisCrossReferenceUrl:
    "https://hisregistries.org/wp-content/uploads/filebase/rog/CountryCodeCrossReference_2.pdf",
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
      rog3: "AF",
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
      rog3: "AX",
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
      rog3: "FQ",
      alternativeNames: ["United States Minor Outlying Islands (the)"],
      classification: "duplicate-iso-territory",
      sourceUri: "iso:code:3166:UM",
    },
  ],
};

const activeVersion = {
  id: "10000000-0000-4000-8000-000000000001",
  resourceKey: "country-territory-codes" as const,
  versionNumber: 1,
  lifecycleState: "valid" as const,
  schemaVersion: 1,
  contentChecksum: "a".repeat(64),
  sourceRetrievedAt: initialResource.sourceRetrievedAt,
  entryCount: initialResource.entryCount,
  validationSummary: {},
  diffSummary: {},
  createdByOwnerId: "admin-1",
  createdAt: initialResource.sourceRetrievedAt,
  finalizedAt: initialResource.sourceRetrievedAt,
  rejectionReason: null,
  isActive: true,
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

  it("renders compact columns and searches through the paged server contract", async () => {
    const searchedResource = { ...initialResource, entries: [initialResource.entries[0]] };
    fetchMock.mockResolvedValue(
      buildJsonResponse({
        resource: searchedResource,
        entries: searchedResource.entries,
        nextCursor: null,
        version: activeVersion,
      }),
    );
    render(
      <IsoCountryCodesClient
        initialResource={initialResource}
        activeVersion={activeVersion}
        initialNextCursor={null}
        canRefresh
        canEditAlternativeNames
      />,
    );

    expect(screen.getByRole("columnheader", { name: "Country/Territory" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "ISO3" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "FIPS" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "ROG3" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "GENC3" })).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "ISO2" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Numeric" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Alternative Names" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Classification" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Copy" })).toBeNull();
    expect(screen.queryByText(/curated rows/)).toBeNull();
    expect(screen.getByText("Updated May 6, 2026, 12:00 AM UTC")).toBeTruthy();
    expect(screen.queryByText(/Active v/u)).toBeNull();
    expect(screen.queryByText(/Retrieved/u)).toBeNull();
    expect(screen.getByRole("button", { name: "Refresh" }).getAttribute("data-smoke-write")).toBe(
      "unsafe",
    );
    expect(screen.getByText("Afghanistan")).toBeTruthy();
    expect(screen.getByText("Akrotiri")).toBeTruthy();
    expect(screen.getByText("Baker Island")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/Search name/), {
      target: { value: "Afganistan" },
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/reference-resources/country-territory-codes/entries?limit=100&search=Afganistan",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ));
    await waitFor(() => expect(screen.queryByText("Akrotiri")).toBeNull());
  });

  it("opens a right-side detail sheet with hidden fields and smoke markers", () => {
    render(
      <IsoCountryCodesClient
        initialResource={initialResource}
        activeVersion={activeVersion}
        initialNextCursor={null}
        canRefresh
        canEditAlternativeNames
      />,
    );

    fireEvent.click(screen.getByText("Afghanistan"));

    expect(screen.getByText("May 6, 2026, 12:00 AM UTC")).toBeTruthy();
    expect(screen.getByText("Primary ISO3")).toBeTruthy();
    expect(screen.getByText("ISO2")).toBeTruthy();
    expect(screen.getAllByText("ROG3").length).toBeGreaterThan(0);
    expect(screen.getByText("Numeric")).toBeTruthy();
    expect(screen.getByText("Classification")).toBeTruthy();
    expect(screen.getByText("Official UN Names")).toBeTruthy();
    expect(screen.getByText("Official UN short name")).toBeTruthy();
    expect(screen.getByText("Official UN formal name")).toBeTruthy();
    expect(screen.getByText("the Islamic Republic of Afghanistan")).toBeTruthy();
    expect(screen.getByText("unterm-m49")).toBeTruthy();
    expect(screen.getByText("Source URI")).toBeTruthy();
    expect(screen.getAllByText("Updated").length).toBeGreaterThan(0);
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
        activeVersion={activeVersion}
        initialNextCursor={null}
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
        activeVersion={activeVersion}
        initialNextCursor={null}
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
        buildJsonResponse({ entry: addedEntry, resource: addedResource, version: { ...activeVersion, versionNumber: 2 } }),
      )
      .mockResolvedValueOnce(
        buildJsonResponse({ entry: deletedEntry, resource: deletedResource, version: { ...activeVersion, versionNumber: 3 } }),
      );
    render(
      <IsoCountryCodesClient
        initialResource={initialResource}
        activeVersion={activeVersion}
        initialNextCursor={null}
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

  it("links downloads to the complete matching server export", () => {
    render(
      <IsoCountryCodesClient
        initialResource={initialResource}
        activeVersion={activeVersion}
        initialNextCursor={null}
        canRefresh={false}
        canEditAlternativeNames={false}
      />,
    );

    expect(screen.queryByRole("button", { name: /Refresh/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "JSON" })).toBeNull();

    fireEvent.change(screen.getByPlaceholderText(/Search name/), {
      target: { value: "Afganistan" },
    });
    expect(screen.getByRole("link", { name: "Download" }).getAttribute("href")).toBe(
      "/api/reference-resources/country-territory-codes/download?search=Afganistan",
    );
  });

  it("persists refresh as a candidate while active rows remain visible", async () => {
    fetchMock.mockResolvedValue(buildJsonResponse({
      unchanged: false,
      version: { ...activeVersion, id: "10000000-0000-4000-8000-000000000002", versionNumber: 2, isActive: false },
    }));
    render(
      <IsoCountryCodesClient
        initialResource={initialResource}
        activeVersion={activeVersion}
        initialNextCursor={null}
        canRefresh
        canEditAlternativeNames
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/iso-country-codes/refresh", {
        method: "POST",
      });
    });
    expect(await screen.findByText("Version 2 is ready for review")).toBeTruthy();
    expect(screen.queryByText("Refresh source data")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Refresh" }).querySelector(".text-emerald-600"),
    ).toBeTruthy();
    expect(screen.getByText("Afghanistan")).toBeTruthy();
  });

  it("keeps generated entries visible when refresh fails", async () => {
    fetchMock.mockResolvedValue(buildJsonResponse({ error: "Nope" }, 502));
    render(
      <IsoCountryCodesClient
        initialResource={initialResource}
        activeVersion={activeVersion}
        initialNextCursor={null}
        canRefresh
        canEditAlternativeNames
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));

    expect(await screen.findByText(/Could not refresh country and territory/)).toBeTruthy();
    expect(screen.queryByText("Refresh source data")).toBeNull();
    expect(screen.getByText("Afghanistan")).toBeTruthy();
  });

  it("appends the next stable cursor page", async () => {
    const firstPage = { ...initialResource, entries: [initialResource.entries[0]] };
    const nextPage = { ...initialResource, entries: [initialResource.entries[1]] };
    fetchMock.mockResolvedValue(buildJsonResponse({
      resource: nextPage,
      entries: nextPage.entries,
      nextCursor: null,
      version: activeVersion,
    }));
    render(
      <IsoCountryCodesClient
        initialResource={firstPage}
        activeVersion={activeVersion}
        initialNextCursor="cursor-1"
        canRefresh={false}
        canEditAlternativeNames={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Akrotiri")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/reference-resources/country-territory-codes/entries?cursor=cursor-1&limit=100",
    );
  });
});
