import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GENC_COUNTRY_CODES_SOURCE_URL,
  ISO_COUNTRY_CODES_SOURCE_URL,
  LEGACY_FIPS_COUNTRY_CODES_SOURCE_URL,
  applyIsoCountryCodeEntryOverrides,
  getGeneratedIsoCountryCodeResource,
  normalizeCountryCodeAlternativeNames,
  parseCountryCodeOverlayCsv,
  refreshIsoCountryCodeResourceFromOfficialSource,
  validateOfficialIsoCountryCodeEntries,
} from "@/lib/iso-country-codes";
import type {
  GencCountryCodeEntry,
  LegacyFipsCountryCodeEntry,
  OfficialIsoCountryCodeEntry,
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
    const gencEntries = createGencEntries(270);
    const fipsEntries = createFipsEntries(200);
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
    });
    expect(fetchMock).toHaveBeenCalledWith(
      GENC_COUNTRY_CODES_SOURCE_URL,
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      LEGACY_FIPS_COUNTRY_CODES_SOURCE_URL,
      expect.any(Object),
    );
    expect(resource.sourceUrl).toBe(ISO_COUNTRY_CODES_SOURCE_URL);
  });
});
