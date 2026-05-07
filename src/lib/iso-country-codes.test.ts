import { afterEach, describe, expect, it, vi } from "vitest";
import { strToU8, zipSync } from "fflate";

import {
  GENC_COUNTRY_CODES_SOURCE_URL,
  ISO_COUNTRY_CODES_SOURCE_URL,
  LEGACY_FIPS_COUNTRY_CODES_SOURCE_URL,
  M49_COUNTRY_CODES_SOURCE_URL,
  UNTERM_COUNTRY_NAMES_SOURCE_URL,
  applyIsoCountryCodeEntryOverrides,
  getGeneratedIsoCountryCodeResource,
  normalizeCountryCodeAlternativeNames,
  parseM49CountryCodeEntries,
  parseCountryCodeOverlayCsv,
  parseUntermCountryNamesWorkbook,
  refreshIsoCountryCodeResourceFromOfficialSource,
  validateOfficialIsoCountryCodeEntries,
} from "@/lib/iso-country-codes";
import type {
  GencCountryCodeEntry,
  LegacyFipsCountryCodeEntry,
  M49CountryCodeEntry,
  OfficialIsoCountryCodeEntry,
  UntermCountryNameEntry,
} from "@/lib/iso-country-codes";

function createCode(index: number, length: 2 | 3) {
  const chars: string[] = [];
  let value = index;

  for (let cursor = 0; cursor < length; cursor += 1) {
    chars.unshift(String.fromCharCode(65 + (value % 26)));
    value = Math.floor(value / 26);
  }

  return chars.join("");
}

function createOfficialEntries(count: number): OfficialIsoCountryCodeEntry[] {
  return Array.from({ length: count }, (_, index) => {
    const alpha2 = createCode(index, 2);
    const alpha3 = createCode(index, 3);

    return {
      alpha2,
      alpha3,
      englishShortName: `Country ${String(index).padStart(3, "0")}`,
      numeric: String(index).padStart(3, "0"),
      uri: `iso:code:3166:${alpha2}`,
    };
  });
}

function createGencEntries(count: number): GencCountryCodeEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    ncitCode: `C${String(index).padStart(5, "0")}`,
    preferredName: `GENC Country ${String(index).padStart(3, "0")}`,
    gencName: `GENC COUNTRY ${String(index).padStart(3, "0")}`,
    alpha2: createCode(index, 2),
    alpha3: createCode(index, 3),
    numeric: String(index).padStart(3, "0"),
  }));
}

function createFipsEntries(count: number): LegacyFipsCountryCodeEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    code: createCode(index, 2),
    name: `FIPS COUNTRY ${String(index).padStart(3, "0")}`,
  }));
}

function createUntermEntries(
  officialEntries: OfficialIsoCountryCodeEntry[],
): UntermCountryNameEntry[] {
  return officialEntries.slice(0, 190).map((entry) => ({
    englishShortName: entry.englishShortName,
    englishFormalName: `the Republic of ${entry.englishShortName}`,
  }));
}

function createM49Entries(
  officialEntries: OfficialIsoCountryCodeEntry[],
): M49CountryCodeEntry[] {
  return officialEntries.map((entry, index) => ({
    countryOrArea: entry.englishShortName,
    m49Code: String(index).padStart(3, "0"),
    alpha3: entry.alpha3,
  }));
}

function columnName(index: number) {
  let value = index + 1;
  let column = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }

  return column;
}

function toUntermWorkbook(entries: UntermCountryNameEntry[]) {
  const values = [
    [
      "English short",
      "French short",
      "Spanish short",
      "Russian short",
      "Chinese short",
      "Arabic short",
      "English formal",
      "French formal",
      "Spanish formal",
      "Russian formal",
      "Chinese formal",
      "Arabic formal",
    ],
    ...entries.map((entry) => [
      entry.englishShortName,
      "",
      "",
      "",
      "",
      "",
      entry.englishFormalName,
      "",
      "",
      "",
      "",
      "",
    ]),
  ];
  const sharedStrings = values.flat();
  let sharedIndex = 0;
  const rows = values
    .map((row, rowIndex) => {
      const cells = row
        .map((_, columnIndex) => {
          const cell = `${columnName(columnIndex)}${rowIndex + 1}`;
          const value = sharedIndex;
          sharedIndex += 1;
          return `<c r="${cell}" t="s"><v>${value}</v></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">${sharedStrings
    .map((value) => `<si><t>${value}</t></si>`)
    .join("")}</sst>`;
  const sheetXml = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`;

  const bytes = zipSync({
    xl: {
      "sharedStrings.xml": strToU8(sharedStringsXml),
      worksheets: {
        "sheet1.xml": strToU8(sheetXml),
      },
    },
  });
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function toM49Html(entries: M49CountryCodeEntry[]) {
  return `<table id = "downloadTableEN"><thead><tr><td>Global Code</td><td>Global Name</td><td>Region Code</td><td>Region Name</td><td>Sub-region Code</td><td>Sub-region Name</td><td>Intermediate Region Code</td><td>Intermediate Region Name</td><td>Country or Area</td><td>M49 Code</td><td>ISO-alpha2 Code</td><td>ISO-alpha3 Code</td></tr></thead><tbody>${entries
    .map(
      (entry) =>
        `<tr><td>001</td><td>World</td><td>002</td><td>Africa</td><td>015</td><td>Northern Africa</td><td></td><td></td><td>${entry.countryOrArea}</td><td>${entry.m49Code}</td><td></td><td>${entry.alpha3}</td></tr>`,
    )
    .join("")}</tbody></table>`;
}

function toGencTsv(entries: GencCountryCodeEntry[]) {
  return [
    [
      "NCIt Concept Code",
      "NCIt Preferred Term",
      "GENC Name (FDA Standard)",
      "GENC 2 Letter Code",
      "GENC 3 Letter Code (FDA Standard)",
      "GENC Number",
      "NCIt Subset Code",
      "NCIt Subset Name",
    ].join("\t"),
    ...entries.map((entry) =>
      [
        entry.ncitCode,
        entry.preferredName,
        entry.gencName,
        entry.alpha2 ?? "",
        entry.alpha3,
        entry.numeric,
        "C124085",
        "Geopolitical Entities, Names and Codes Terminology",
      ].join("\t"),
    ),
  ].join("\n");
}

function toFipsHtml(entries: LegacyFipsCountryCodeEntry[]) {
  return `<table>${entries
    .map((entry) => `<tr><td>${entry.code}</td><td>${entry.name}</td></tr>`)
    .join("")}</table>`;
}

function toVaadinRows(entries: OfficialIsoCountryCodeEntry[]) {
  return entries.map((entry, index) => ({
    k: String(index + 1),
    d: {
      "142": "country",
      "144": entry.alpha2,
      "148": entry.englishShortName,
      "162": entry.numeric,
      "164": entry.uri,
      "166": entry.alpha3,
      "176": "Officially assigned",
    },
  }));
}

describe("ISO country codes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses the transposed curated overlay with aliases, blanks, and quoted names", () => {
    const overlayRows = parseCountryCodeOverlayCsv(`Active,TRUE,FALSE,TRUE,TRUE
ISO3,AFG,,UMI,BES
FIPS,AF,AX,FQ,NT
Country / Territory,Afghanistan,Akrotiri,Baker Island,"Bonaire, Sint Eustatius and Saba"
Country Alt Names 1,Afganistan,,United States Minor Outlying Islands (the),Netherlands Antilles
Country Alt Names 2,Afganistan,,Baker Island,"Bonaire, Sint Eustatius, and Saba"
Country Alt Names 3,Republic of Afghanistan,,,
Country Alt Names 4,,,,
Country Alt Names 5,,,,
Country Alt Names 6,,,,
Country Alt Names 7,,,,
Country Alt Names 8,,,,
Country Alt Names 9,,,,
Country Alt Names 10,,,,
Country Alt Names 11,,,,
Country Alt Names 12,,,,
`);

    expect(overlayRows).toHaveLength(4);
    expect(overlayRows[0]).toMatchObject({
      displayName: "Afghanistan",
      active: true,
      primaryAlpha3: "AFG",
      fips: "AF",
      alternativeNames: ["Afganistan", "Republic of Afghanistan"],
    });
    expect(overlayRows[1]).toMatchObject({
      displayName: "Akrotiri",
      active: false,
      primaryAlpha3: null,
      fips: "AX",
    });
    expect(overlayRows[2].alternativeNames).toEqual([
      "United States Minor Outlying Islands (the)",
    ]);
    expect(overlayRows[3].displayName).toBe("Bonaire, Sint Eustatius and Saba");
  });

  it("loads the generated enriched country and territory resource", () => {
    const resource = getGeneratedIsoCountryCodeResource();

    expect(resource.entryCount).toBe(273);
    expect(resource.officialIsoCount).toBe(249);
    expect(resource.activeCount).toBe(259);

    expect(resource.entries.find((entry) => entry.displayName === "Kosovo")).toMatchObject({
      primaryAlpha3: "KOS",
      gencAlpha3: "XKS",
      fips: "KV",
      classification: "non-official-code",
    });
    expect(
      resource.entries.find((entry) => entry.displayName === "Baker Island"),
    ).toMatchObject({
      primaryAlpha3: "UMI",
      gencAlpha3: "XBK",
      fips: "FQ",
      classification: "duplicate-iso-territory",
    });
    expect(
      resource.entries.find(
        (entry) => entry.displayName === "United States Minor Outlying Islands",
      ),
    ).toMatchObject({
      primaryAlpha3: "UMI",
      classification: "iso-official",
    });
    expect(resource.entries.filter((entry) => entry.primaryAlpha3 === "PSE")).toHaveLength(
      3,
    );
    expect(
      resource.entries.find((entry) => entry.displayName === "Afghanistan"),
    ).toMatchObject({
      untermEnglishShortName: "Afghanistan",
      untermEnglishFormalName: expect.stringContaining("Afghanistan"),
      untermNameSource: "unterm-m49",
    });
  });

  it("parses UNTERM country-name workbooks", () => {
    const entries = parseUntermCountryNamesWorkbook(
      toUntermWorkbook([
        {
          englishShortName: "Afghanistan",
          englishFormalName: "the Islamic Republic of Afghanistan",
        },
      ]),
      1,
    );

    expect(entries).toEqual([
      {
        englishShortName: "Afghanistan",
        englishFormalName: "the Islamic Republic of Afghanistan",
      },
    ]);
  });

  it("parses M49 country names and ISO3 bridge rows", () => {
    expect(
      parseM49CountryCodeEntries(
        toM49Html([
          {
            countryOrArea: "Afghanistan",
            m49Code: "004",
            alpha3: "AFG",
          },
        ]),
        1,
      ),
    ).toEqual([
      {
        countryOrArea: "Afghanistan",
        m49Code: "004",
        alpha3: "AFG",
      },
    ]);
  });

  it("normalizes and applies persisted alternate-name overrides", () => {
    const resource = getGeneratedIsoCountryCodeResource();
    const afghanistan = resource.entries.find(
      (entry) => entry.displayName === "Afghanistan",
    );
    expect(afghanistan).toBeTruthy();

    expect(
      normalizeCountryCodeAlternativeNames("Afghanistan", [
        "Afghanistan",
        "Afganistan",
        "Afganistan",
        "",
        "Republic of Afghanistan",
      ]),
    ).toEqual(["Afganistan", "Republic of Afghanistan"]);

    const updatedResource = applyIsoCountryCodeEntryOverrides(resource, [
      {
        displayName: "Afghanistan",
        alternativeNames: ["Persisted alias"],
      },
    ]);

    expect(
      updatedResource.entries.find((entry) => entry.displayName === "Afghanistan"),
    ).toMatchObject({
      alternativeNames: ["Persisted alias"],
    });
  });

  it("rejects duplicate official ISO3 entries", () => {
    expect(() =>
      validateOfficialIsoCountryCodeEntries([
        ...createOfficialEntries(240),
        {
          alpha2: "ZZ",
          alpha3: "AAA",
          englishShortName: "Duplicate",
          numeric: "999",
          uri: "iso:code:3166:ZZ",
        },
      ]),
    ).toThrow("Duplicate ISO alpha-3 code");
  });

  it("refreshes from ISO OBP, GENC, FIPS, and the curated overlay", async () => {
    const officialEntries = createOfficialEntries(240);
    officialEntries[0] = {
      alpha2: "AF",
      alpha3: "AFG",
      englishShortName: "Afghanistan",
      numeric: "004",
      uri: "iso:code:3166:AF",
    };
    const duplicateAfgIndex = officialEntries.findIndex(
      (entry, index) => index > 0 && entry.alpha3 === "AFG",
    );
    const duplicateAfIndex = officialEntries.findIndex(
      (entry, index) => index > 0 && entry.alpha2 === "AF",
    );

    if (duplicateAfgIndex >= 0) {
      officialEntries[duplicateAfgIndex] = {
        alpha2: "ZY",
        alpha3: "ZZZ",
        englishShortName: "Country ZZZ",
        numeric: "999",
        uri: "iso:code:3166:ZY",
      };
    }

    if (duplicateAfIndex >= 0 && duplicateAfIndex !== duplicateAfgIndex) {
      officialEntries[duplicateAfIndex] = {
        alpha2: "ZZ",
        alpha3: "ZZY",
        englishShortName: "Country ZZY",
        numeric: "998",
        uri: "iso:code:3166:ZZ",
      };
    }
    const gencEntries = createGencEntries(270);
    const fipsEntries = createFipsEntries(200);
    const untermEntries = createUntermEntries(officialEntries);
    const m49Entries = createM49Entries(officialEntries);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "https://www.iso.org/obp/ui/") {
        return new Response("<html></html>", {
          headers: { "set-cookie": "JSESSIONID=abc; Path=/obp" },
        });
      }

      if (url.startsWith("https://www.iso.org/obp/ui/?v-")) {
        return Response.json({
          uidl: JSON.stringify({
            "Vaadin-Security-Key": "token-1",
            syncId: 0,
            clientId: 0,
            state: {},
            rpc: [
              [
                "135",
                "com.vaadin.shared.data.DataCommunicatorClientRpc",
                "setData",
                [0, toVaadinRows(officialEntries)],
              ],
            ],
          }),
        });
      }

      if (url === GENC_COUNTRY_CODES_SOURCE_URL) {
        return new Response(toGencTsv(gencEntries));
      }

      if (url === LEGACY_FIPS_COUNTRY_CODES_SOURCE_URL) {
        return new Response(toFipsHtml(fipsEntries));
      }

      if (url === UNTERM_COUNTRY_NAMES_SOURCE_URL) {
        return new Response(toUntermWorkbook(untermEntries));
      }

      if (url === M49_COUNTRY_CODES_SOURCE_URL) {
        return new Response(toM49Html(m49Entries));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const resource = await refreshIsoCountryCodeResourceFromOfficialSource();

    expect(resource.entryCount).toBe(273);
    expect(resource.officialIsoCount).toBe(240);
    expect(resource.activeCount).toBe(259);
    expect(resource.entries[0]).toMatchObject({
      displayName: "Afghanistan",
      primaryAlpha3: "AFG",
      fips: "AF",
      untermEnglishShortName: "Afghanistan",
      untermEnglishFormalName: "the Republic of Afghanistan",
      untermNameSource: "unterm-m49",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      GENC_COUNTRY_CODES_SOURCE_URL,
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      LEGACY_FIPS_COUNTRY_CODES_SOURCE_URL,
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      UNTERM_COUNTRY_NAMES_SOURCE_URL,
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      M49_COUNTRY_CODES_SOURCE_URL,
      expect.any(Object),
    );
    expect(resource.sourceUrl).toBe(ISO_COUNTRY_CODES_SOURCE_URL);
    expect(resource.untermSourceUrl).toBe(UNTERM_COUNTRY_NAMES_SOURCE_URL);
    expect(resource.m49SourceUrl).toBe(M49_COUNTRY_CODES_SOURCE_URL);
  });
});
