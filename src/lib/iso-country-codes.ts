import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { unzipSync } from "fflate";
import Papa from "papaparse";

import { getDb } from "@/db";
import { isoCountryCodeEntryOverrides } from "@/db/schema";
import generatedIsoCountryCodes from "@/data/iso-country-codes.generated.json";

const execFileAsync = promisify(execFile);

export const ISO_COUNTRY_CODES_SOURCE_URL =
  "https://www.iso.org/obp/ui/#search/code/";
export const ISO_COUNTRY_CODES_COLLECTION_URL =
  "https://www.iso.org/publication/PUB500001.html";
export const GENC_COUNTRY_CODES_SOURCE_URL =
  "https://evs.nci.nih.gov/ftp1/GENC/NCIt-GENC_Terminology.txt";
export const GENC_COUNTRY_CODES_ABOUT_URL =
  "https://evs.nci.nih.gov/ftp1/GENC/About.html";
export const LEGACY_FIPS_COUNTRY_CODES_SOURCE_URL =
  "https://nief.org/attribute-registry/codesets/FIPS10-4CountryCode/";
export const FIPS_WITHDRAWAL_SOURCE_URL =
  "https://csrc.nist.gov/news/2008/announcing-approval-of-the-withdrawal-of-ten-fip-s";
export const ROG3_COUNTRY_CODES_SOURCE_URL =
  "https://geonames.nga.mil/geonames/GNSSearch/GNSDocs/xlsdocs/GENC_ED3U24_GEC_XWALK.xlsx";
export const ROG3_HIS_REGISTRY_URL = "https://hisregistries.org/rog/";
export const ROG3_HIS_CROSS_REFERENCE_URL =
  "https://hisregistries.org/wp-content/uploads/filebase/rog/CountryCodeCrossReference_2.pdf";
export const UNTERM_COUNTRY_NAMES_SOURCE_URL =
  "https://conferences.unite.un.org/untermapi/api/term/downloadCountries";
export const M49_COUNTRY_CODES_SOURCE_URL =
  "https://unstats.un.org/unsd/methodology/m49/overview/";
export const COUNTRY_CODE_OVERLAY_SOURCE_NAME =
  "Accelerate Global - Spec Sheet - ISO3.csv";
export const COUNTRY_CODE_OVERLAY_PATH = path.join(
  process.cwd(),
  "src/data/country-codes/accelerate-global-iso3-overlay.csv",
);
export const ISO_COUNTRY_CODES_MINIMUM_COUNT = 240;
export const GENC_COUNTRY_CODES_MINIMUM_COUNT = 270;
export const LEGACY_FIPS_COUNTRY_CODES_MINIMUM_COUNT = 200;
export const ROG3_COUNTRY_CODES_MINIMUM_COUNT = 280;
export const ROG3_LISTED_CODES_MINIMUM_COUNT = 200;
export const UNTERM_COUNTRY_NAMES_MINIMUM_COUNT = 190;
export const M49_COUNTRY_CODES_MINIMUM_COUNT = 240;
export const COUNTRY_CODE_OVERLAY_EXPECTED_COUNT = 273;
export const COUNTRY_CODE_OVERLAY_EXPECTED_ACTIVE_COUNT = 259;

export type UntermNameSource = "unterm-m49";

export type CountryCodeClassification =
  | "iso-official"
  | "genc-supported"
  | "duplicate-iso-territory"
  | "legacy-fips-only"
  | "csv-only"
  | "non-official-code";

export type IsoCountryCodeEntry = {
  displayName: string;
  active: boolean;
  primaryAlpha3: string | null;
  officialIsoAlpha2: string | null;
  officialIsoAlpha3: string | null;
  officialIsoNumeric: string | null;
  untermEnglishShortName: string | null;
  untermEnglishFormalName: string | null;
  untermNameSource: UntermNameSource | null;
  gencAlpha2: string | null;
  gencAlpha3: string | null;
  gencNumeric: string | null;
  fips: string | null;
  rog3: string | null;
  alternativeNames: string[];
  classification: CountryCodeClassification;
  sourceUri: string | null;
};

export type IsoCountryCodeResource = {
  sourceName: string;
  sourceUrl: string;
  sourceRetrievedAt: string;
  sourceCollectionUrl: string;
  gencSourceUrl: string;
  gencAboutUrl: string;
  fipsSourceUrl: string;
  fipsWithdrawalUrl: string;
  rog3SourceUrl: string;
  rog3HisRegistryUrl: string;
  rog3HisCrossReferenceUrl: string;
  untermSourceUrl: string;
  m49SourceUrl: string;
  overlaySourceName: string;
  entryCount: number;
  officialIsoCount: number;
  activeCount: number;
  entries: IsoCountryCodeEntry[];
};

export type IsoCountryCodeEntryOverride = {
  displayName: string;
  alternativeNames: string[];
};

export type OfficialIsoCountryCodeEntry = {
  alpha2: string;
  alpha3: string;
  englishShortName: string;
  numeric: string;
  uri: string;
};

export type GencCountryCodeEntry = {
  ncitCode: string;
  preferredName: string;
  gencName: string;
  alpha2: string | null;
  alpha3: string;
  numeric: string;
};

export type LegacyFipsCountryCodeEntry = {
  code: string;
  name: string;
};

export type Rog3CountryCodeEntry = {
  gencAlpha3: string;
  gencAlpha2: string;
  numeric: string;
  name: string;
  shortName: string;
  fullName: string;
  rog3: string | null;
};

export type UntermCountryNameEntry = {
  englishShortName: string;
  englishFormalName: string | null;
};

export type M49CountryCodeEntry = {
  countryOrArea: string;
  m49Code: string;
  alpha3: string;
};

export type CountryCodeOverlayRow = {
  displayName: string;
  active: boolean;
  primaryAlpha3: string | null;
  fips: string | null;
  alternativeNames: string[];
};

type VaadinMessage = {
  "Vaadin-Security-Key"?: string;
  syncId?: number;
  clientId?: number;
  state?: Record<string, { caption?: string; enabled?: boolean; text?: string }>;
  rpc?: unknown[];
};

type BuildIsoCountryCodeResourceInput = {
  officialEntries: OfficialIsoCountryCodeEntry[];
  gencEntries: GencCountryCodeEntry[];
  fipsEntries: LegacyFipsCountryCodeEntry[];
  rog3Entries: Rog3CountryCodeEntry[];
  untermEntries: UntermCountryNameEntry[];
  m49Entries: M49CountryCodeEntry[];
  overlayRows: CountryCodeOverlayRow[];
  sourceRetrievedAt?: string;
  expectedOverlayCount?: number;
  expectedActiveCount?: number;
};

const GRID_FIELD_IDS = {
  alpha2: "144",
  englishShortName: "148",
  numeric: "162",
  alpha3: "166",
  uri: "164",
  codeType: "142",
  status: "176",
} as const;

const CLASSIFICATIONS = new Set<CountryCodeClassification>([
  "iso-official",
  "genc-supported",
  "duplicate-iso-territory",
  "legacy-fips-only",
  "csv-only",
  "non-official-code",
]);

function assertString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Country code entry is missing ${label}.`);
  }

  return value.trim();
}

function nullableCode(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toUpperCase() : null;
}

function normalizeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bthe\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function dedupeAlternativeNames(displayName: string, values: unknown[]) {
  const displayNameKey = displayName.trim().toLocaleLowerCase();
  const seen = new Set<string>([displayNameKey]);
  const alternativeNames: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();
    const key = trimmed.toLocaleLowerCase();

    if (!trimmed || seen.has(key)) {
      continue;
    }

    seen.add(key);
    alternativeNames.push(trimmed);
  }

  return alternativeNames;
}

export function normalizeCountryCodeAlternativeNames(
  displayName: string,
  values: unknown[],
) {
  return dedupeAlternativeNames(displayName, values);
}

function parseBoolean(value: unknown, label: string) {
  if (value === "TRUE") {
    return true;
  }

  if (value === "FALSE") {
    return false;
  }

  throw new Error(`Invalid boolean value for ${label}.`);
}

function parseDelimitedRows(text: string) {
  const parsed = Papa.parse<string[]>(text, {
    skipEmptyLines: false,
  });

  if (parsed.errors.length > 0) {
    throw new Error(`Could not parse country-code CSV: ${parsed.errors[0].message}`);
  }

  return parsed.data.filter((row) => row.some((value) => value.trim().length > 0));
}

function decodeXmlText(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function decodeHtmlText(value: string) {
  return decodeXmlText(
    value
      .replace(/&#(\d+);/g, (_match, codePoint: string) =>
        String.fromCodePoint(Number(codePoint)),
      )
      .replace(/&#x([0-9a-f]+);/giu, (_match, codePoint: string) =>
        String.fromCodePoint(Number.parseInt(codePoint, 16)),
      )
      .replace(/&nbsp;/g, " "),
  )
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getXlsxTextFile(files: Record<string, Uint8Array>, filePath: string) {
  const file = files[filePath];

  if (!file) {
    throw new Error(`XLSX workbook is missing ${filePath}.`);
  }

  return new TextDecoder().decode(file);
}

function parseSharedStrings(xml: string) {
  return Array.from(xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)).map((match) => {
    const textParts = Array.from(match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g));
    return textParts.map((part) => decodeXmlText(part[1])).join("");
  });
}

function getColumnIndex(cellReference: string) {
  const column = cellReference.replace(/\d+/g, "");
  let index = 0;

  for (const char of column) {
    index = index * 26 + char.charCodeAt(0) - 64;
  }

  return index - 1;
}

export function parseXlsxFirstSheetRows(input: ArrayBuffer | Uint8Array) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const files = unzipSync(bytes);
  const sharedStrings = parseSharedStrings(
    getXlsxTextFile(files, "xl/sharedStrings.xml"),
  );
  const sheetXml = getXlsxTextFile(files, "xl/worksheets/sheet1.xml");

  return Array.from(sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g))
    .map((rowMatch) => {
      const row: string[] = [];

      for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
        const attrs = cellMatch[1];
        const body = cellMatch[2];
        const reference = attrs.match(/\br="([^"]+)"/)?.[1];
        const columnIndex = reference ? getColumnIndex(reference) : row.length;
        const type = attrs.match(/\bt="([^"]+)"/)?.[1];
        const value = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        const inlineText = body.match(/<t\b[^>]*>([\s\S]*?)<\/t>/)?.[1];

        if (value === undefined && inlineText === undefined) {
          row[columnIndex] = "";
          continue;
        }

        row[columnIndex] =
          type === "s" && value !== undefined
            ? sharedStrings[Number(value)] ?? ""
            : decodeXmlText(inlineText ?? value ?? "");
      }

      return row.map((value) => value.trim());
    })
    .filter((row) => row.some((value) => value.length > 0));
}

export function parseUntermCountryNamesWorkbook(
  input: ArrayBuffer | Uint8Array,
  minimumCount = UNTERM_COUNTRY_NAMES_MINIMUM_COUNT,
) {
  const rows = parseXlsxFirstSheetRows(input);
  const header = rows[0] ?? [];
  const englishShortIndex = header.indexOf("English short");
  const englishFormalIndex = header.indexOf("English formal");

  if (englishShortIndex < 0 || englishFormalIndex < 0) {
    throw new Error("UNTERM country names workbook is missing required columns.");
  }

  const entries = rows.slice(1).flatMap((row) => {
    const englishShortName = row[englishShortIndex]?.trim() ?? "";
    const englishFormalName = row[englishFormalIndex]?.trim() ?? "";

    if (!englishShortName) {
      return [];
    }

    return [
      {
        englishShortName,
        englishFormalName: englishFormalName || null,
      },
    ];
  });

  validateUntermCountryNameEntries(entries, minimumCount);
  return entries;
}

function normalizeRog3Code(value: string | undefined) {
  const code = value?.trim().toUpperCase() ?? "";

  if (!code || code === "--") {
    return null;
  }

  return code;
}

function normalizeNumericCode(value: string | undefined) {
  const numeric = value?.trim() ?? "";

  if (!/^\d+$/.test(numeric)) {
    return numeric;
  }

  return numeric.padStart(3, "0");
}

export function parseRog3CountryCodeEntriesWorkbook(
  input: ArrayBuffer | Uint8Array,
  minimumCount = ROG3_COUNTRY_CODES_MINIMUM_COUNT,
  listedMinimumCount = ROG3_LISTED_CODES_MINIMUM_COUNT,
) {
  const rows = parseXlsxFirstSheetRows(input);
  const headerIndex = rows.findIndex(
    (row) => row.includes("3-character Code") && row.includes("GEC"),
  );

  if (headerIndex < 0) {
    throw new Error("ROG3 country-code workbook is missing required columns.");
  }

  const header = rows[headerIndex] ?? [];
  const gencAlpha3Index = header.indexOf("3-character Code");
  const gencAlpha2Index = header.indexOf("2-character Code");
  const numericIndex = header.indexOf("Numeric Code");
  const nameIndex = header.indexOf("Name");
  const shortNameIndex = header.indexOf("Short Name");
  const fullNameIndex = header.indexOf("Full Name");
  const rog3Index = header.indexOf("GEC");

  if (
    gencAlpha3Index < 0 ||
    gencAlpha2Index < 0 ||
    numericIndex < 0 ||
    nameIndex < 0 ||
    shortNameIndex < 0 ||
    fullNameIndex < 0 ||
    rog3Index < 0
  ) {
    throw new Error("ROG3 country-code workbook is missing required columns.");
  }

  const entries = rows.slice(headerIndex + 1).flatMap((row) => {
    const gencAlpha3 = nullableCode(row[gencAlpha3Index]);
    const gencAlpha2 = nullableCode(row[gencAlpha2Index]);
    const numeric = normalizeNumericCode(row[numericIndex]);
    const name = row[nameIndex]?.trim() ?? "";
    const shortName = row[shortNameIndex]?.trim() ?? "";
    const fullName = row[fullNameIndex]?.trim() ?? "";

    if (!gencAlpha3 && !name && !shortName) {
      return [];
    }

    if (gencAlpha2 === "[NONE]") {
      return [];
    }

    return [
      {
        gencAlpha3: assertString(gencAlpha3, "ROG3 source GENC alpha-3 code"),
        gencAlpha2: assertString(gencAlpha2, "ROG3 source GENC alpha-2 code"),
        numeric: assertString(numeric, "ROG3 source numeric code"),
        name: assertString(name, "ROG3 source name"),
        shortName: assertString(shortName, "ROG3 source short name"),
        fullName: assertString(fullName, "ROG3 source full name"),
        rog3: normalizeRog3Code(row[rog3Index]),
      },
    ];
  });

  validateRog3CountryCodeEntries(entries, minimumCount, listedMinimumCount);
  return entries;
}

export function parseM49CountryCodeEntries(
  html: string,
  minimumCount = M49_COUNTRY_CODES_MINIMUM_COUNT,
) {
  const tableMatch = html.match(
    /<table[^>]*id\s*=\s*["']?downloadTableEN["']?[^>]*>([\s\S]*?)<\/table>/i,
  );

  if (!tableMatch) {
    throw new Error("M49 page is missing the English countries table.");
  }

  const rows = Array.from(tableMatch[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi))
    .map((rowMatch) =>
      Array.from(rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)).map(
        (cellMatch) => decodeHtmlText(cellMatch[1]),
      ),
    )
    .filter((row) => row.length > 0);
  const header = rows[0] ?? [];
  const countryIndex = header.indexOf("Country or Area");
  const m49Index = header.indexOf("M49 Code");
  const alpha3Index = header.indexOf("ISO-alpha3 Code");

  if (countryIndex < 0 || m49Index < 0 || alpha3Index < 0) {
    throw new Error("M49 page is missing required country-code columns.");
  }

  const entries = rows.slice(1).flatMap((row) => {
    const countryOrArea = row[countryIndex]?.trim() ?? "";
    const m49Code = row[m49Index]?.trim() ?? "";
    const alpha3 = row[alpha3Index]?.trim().toUpperCase() ?? "";

    if (!countryOrArea || !m49Code || !alpha3) {
      return [];
    }

    return [
      {
        countryOrArea,
        m49Code,
        alpha3,
      },
    ];
  });

  validateM49CountryCodeEntries(entries, minimumCount);
  return entries;
}

export function parseCountryCodeOverlayCsv(text: string) {
  const rows = parseDelimitedRows(text);
  const rowsByLabel = new Map<string, string[]>();

  for (const row of rows) {
    const [label, ...values] = row;

    if (label) {
      rowsByLabel.set(label.trim(), values);
    }
  }

  function getRow(label: string) {
    const row = rowsByLabel.get(label);

    if (!row) {
      throw new Error(`Country-code overlay is missing ${label}.`);
    }

    return row;
  }

  const countryNames = getRow("Country / Territory");
  const activeValues = getRow("Active");
  const primaryAlpha3Values = getRow("ISO3");
  const fipsValues = getRow("FIPS");
  const alternativeNameRows = [...rowsByLabel.entries()]
    .filter(([label]) => /^Country Alt Names \d+$/.test(label))
    .sort(([a], [b]) => {
      const aIndex = Number(a.replace("Country Alt Names ", ""));
      const bIndex = Number(b.replace("Country Alt Names ", ""));
      return aIndex - bIndex;
    })
    .map(([, row]) => row);

  if (alternativeNameRows.length !== 12) {
    throw new Error("Country-code overlay must include 12 alternative-name rows.");
  }

  return countryNames.map((countryName, index) => {
    const displayName = assertString(
      countryName,
      `country/territory name at column ${index + 2}`,
    );
    const alternativeNames = dedupeAlternativeNames(
      displayName,
      alternativeNameRows.map((row) => row[index] ?? ""),
    );

    return {
      displayName,
      active: parseBoolean(activeValues[index], displayName),
      primaryAlpha3: nullableCode(primaryAlpha3Values[index]),
      fips: nullableCode(fipsValues[index]),
      alternativeNames,
    };
  });
}

export async function readCountryCodeOverlayRows() {
  const text = await readFile(COUNTRY_CODE_OVERLAY_PATH, "utf8");
  return parseCountryCodeOverlayCsv(text);
}

export function validateOfficialIsoCountryCodeEntries(
  entries: OfficialIsoCountryCodeEntry[],
  minimumCount = ISO_COUNTRY_CODES_MINIMUM_COUNT,
) {
  if (entries.length < minimumCount) {
    throw new Error(
      `ISO country code refresh returned ${entries.length} entries; expected at least ${minimumCount}.`,
    );
  }

  const alpha2Values = new Set<string>();
  const alpha3Values = new Set<string>();

  for (const entry of entries) {
    if (!/^[A-Z]{2}$/.test(entry.alpha2)) {
      throw new Error(`Invalid ISO alpha-2 code: ${entry.alpha2}`);
    }

    if (!/^[A-Z]{3}$/.test(entry.alpha3)) {
      throw new Error(`Invalid ISO alpha-3 code: ${entry.alpha3}`);
    }

    if (!/^\d{3}$/.test(entry.numeric)) {
      throw new Error(`Invalid ISO numeric code for ${entry.alpha3}.`);
    }

    if (!entry.uri.startsWith("iso:code:3166:")) {
      throw new Error(`Invalid ISO source URI for ${entry.alpha3}.`);
    }

    if (alpha2Values.has(entry.alpha2)) {
      throw new Error(`Duplicate ISO alpha-2 code: ${entry.alpha2}`);
    }

    if (alpha3Values.has(entry.alpha3)) {
      throw new Error(`Duplicate ISO alpha-3 code: ${entry.alpha3}`);
    }

    alpha2Values.add(entry.alpha2);
    alpha3Values.add(entry.alpha3);
  }
}

export function validateGencCountryCodeEntries(
  entries: GencCountryCodeEntry[],
  minimumCount = GENC_COUNTRY_CODES_MINIMUM_COUNT,
) {
  if (entries.length < minimumCount) {
    throw new Error(
      `GENC country code refresh returned ${entries.length} entries; expected at least ${minimumCount}.`,
    );
  }

  const alpha3Values = new Set<string>();

  for (const entry of entries) {
    if (!entry.preferredName || !entry.gencName) {
      throw new Error(`GENC entry ${entry.alpha3} is missing a name.`);
    }

    if (entry.alpha2 && !/^[A-Z0-9]{2}$/.test(entry.alpha2)) {
      throw new Error(`Invalid GENC alpha-2 code: ${entry.alpha2}`);
    }

    if (!/^[A-Z0-9]{3}$/.test(entry.alpha3)) {
      throw new Error(`Invalid GENC alpha-3 code: ${entry.alpha3}`);
    }

    if (!/^\d{3}$/.test(entry.numeric)) {
      throw new Error(`Invalid GENC numeric code for ${entry.alpha3}.`);
    }

    if (alpha3Values.has(entry.alpha3)) {
      throw new Error(`Duplicate GENC alpha-3 code: ${entry.alpha3}`);
    }

    alpha3Values.add(entry.alpha3);
  }
}

export function validateLegacyFipsCountryCodeEntries(
  entries: LegacyFipsCountryCodeEntry[],
  minimumCount = LEGACY_FIPS_COUNTRY_CODES_MINIMUM_COUNT,
) {
  if (entries.length < minimumCount) {
    throw new Error(
      `Legacy FIPS refresh returned ${entries.length} entries; expected at least ${minimumCount}.`,
    );
  }

  const codeValues = new Set<string>();

  for (const entry of entries) {
    if (!/^[A-Z]{2}$/.test(entry.code)) {
      throw new Error(`Invalid legacy FIPS code: ${entry.code}`);
    }

    if (!entry.name) {
      throw new Error(`Legacy FIPS entry ${entry.code} is missing a name.`);
    }

    if (codeValues.has(entry.code)) {
      throw new Error(`Duplicate legacy FIPS code: ${entry.code}`);
    }

    codeValues.add(entry.code);
  }
}

export function validateRog3CountryCodeEntries(
  entries: Rog3CountryCodeEntry[],
  minimumCount = ROG3_COUNTRY_CODES_MINIMUM_COUNT,
  listedMinimumCount = ROG3_LISTED_CODES_MINIMUM_COUNT,
) {
  if (entries.length < minimumCount) {
    throw new Error(
      `ROG3 country code refresh returned ${entries.length} entries; expected at least ${minimumCount}.`,
    );
  }

  const gencAlpha3Values = new Set<string>();
  const rog3Values = new Set<string>();

  for (const entry of entries) {
    assertString(entry.name, "ROG3 source name");
    assertString(entry.shortName, "ROG3 source short name");
    assertString(entry.fullName, "ROG3 source full name");

    if (!/^[A-Z0-9]{3}$/.test(entry.gencAlpha3)) {
      throw new Error(`Invalid ROG3 source GENC alpha-3 code: ${entry.gencAlpha3}.`);
    }

    if (!/^[A-Z0-9]{2}$/.test(entry.gencAlpha2)) {
      throw new Error(`Invalid ROG3 source GENC alpha-2 code: ${entry.gencAlpha2}.`);
    }

    if (!/^\d{3}$/.test(entry.numeric)) {
      throw new Error(`Invalid ROG3 source numeric code for ${entry.gencAlpha3}.`);
    }

    if (entry.rog3 && !/^[A-Z]{2}$/.test(entry.rog3)) {
      throw new Error(`Invalid ROG3 code for ${entry.shortName}: ${entry.rog3}.`);
    }

    if (gencAlpha3Values.has(entry.gencAlpha3)) {
      throw new Error(`Duplicate ROG3 source GENC alpha-3 code: ${entry.gencAlpha3}`);
    }

    if (entry.rog3) {
      if (rog3Values.has(entry.rog3)) {
        throw new Error(`Duplicate ROG3 code: ${entry.rog3}`);
      }

      rog3Values.add(entry.rog3);
    }

    gencAlpha3Values.add(entry.gencAlpha3);
  }

  if (rog3Values.size < listedMinimumCount) {
    throw new Error(
      `ROG3 country code refresh returned ${rog3Values.size} listed codes; expected at least ${listedMinimumCount}.`,
    );
  }
}

export function validateUntermCountryNameEntries(
  entries: UntermCountryNameEntry[],
  minimumCount = UNTERM_COUNTRY_NAMES_MINIMUM_COUNT,
) {
  if (entries.length < minimumCount) {
    throw new Error(
      `UNTERM country-name refresh returned ${entries.length} entries; expected at least ${minimumCount}.`,
    );
  }

  const shortNames = new Set<string>();

  for (const entry of entries) {
    assertString(entry.englishShortName, "UNTERM English short name");

    const normalizedName = normalizeName(entry.englishShortName);

    if (shortNames.has(normalizedName)) {
      throw new Error(`Duplicate UNTERM country name: ${entry.englishShortName}`);
    }

    shortNames.add(normalizedName);
  }
}

export function validateM49CountryCodeEntries(
  entries: M49CountryCodeEntry[],
  minimumCount = M49_COUNTRY_CODES_MINIMUM_COUNT,
) {
  if (entries.length < minimumCount) {
    throw new Error(
      `M49 country-code refresh returned ${entries.length} entries; expected at least ${minimumCount}.`,
    );
  }

  const alpha3Values = new Set<string>();

  for (const entry of entries) {
    assertString(entry.countryOrArea, "M49 country or area");

    if (!/^\d{3}$/.test(entry.m49Code)) {
      throw new Error(`Invalid M49 code for ${entry.countryOrArea}.`);
    }

    if (!/^[A-Z]{3}$/.test(entry.alpha3)) {
      throw new Error(`Invalid M49 ISO alpha-3 code: ${entry.alpha3}`);
    }

    if (alpha3Values.has(entry.alpha3)) {
      throw new Error(`Duplicate M49 ISO alpha-3 code: ${entry.alpha3}`);
    }

    alpha3Values.add(entry.alpha3);
  }
}

function validateCountryCodeOverlayRows(
  rows: CountryCodeOverlayRow[],
  expectedCount = COUNTRY_CODE_OVERLAY_EXPECTED_COUNT,
  expectedActiveCount = COUNTRY_CODE_OVERLAY_EXPECTED_ACTIVE_COUNT,
) {
  if (rows.length !== expectedCount) {
    throw new Error(
      `Country-code overlay returned ${rows.length} rows; expected ${expectedCount}.`,
    );
  }

  const activeCount = rows.filter((row) => row.active).length;

  if (activeCount !== expectedActiveCount) {
    throw new Error(
      `Country-code overlay returned ${activeCount} active rows; expected ${expectedActiveCount}.`,
    );
  }

  for (const row of rows) {
    assertString(row.displayName, "display name");

    if (row.primaryAlpha3 && !/^[A-Z0-9]{3}$/.test(row.primaryAlpha3)) {
      throw new Error(`Invalid primary alpha-3 code for ${row.displayName}.`);
    }

    if (row.fips && !/^[A-Z]{2}$/.test(row.fips)) {
      throw new Error(`Invalid FIPS code for ${row.displayName}.`);
    }
  }
}

function getPrimaryAlpha3Counts(rows: CountryCodeOverlayRow[]) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    if (row.primaryAlpha3) {
      counts.set(row.primaryAlpha3, (counts.get(row.primaryAlpha3) ?? 0) + 1);
    }
  }

  return counts;
}

function getActivePrimaryAlpha3Counts(rows: CountryCodeOverlayRow[]) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    if (row.primaryAlpha3 && row.active) {
      counts.set(row.primaryAlpha3, (counts.get(row.primaryAlpha3) ?? 0) + 1);
    }
  }

  return counts;
}

function buildNameIndex<T>(
  entries: T[],
  getNames: (entry: T) => Array<string | null | undefined>,
) {
  const index = new Map<string, T>();

  for (const entry of entries) {
    for (const name of getNames(entry)) {
      if (!name) {
        continue;
      }

      const normalizedName = normalizeName(name);

      if (normalizedName && !index.has(normalizedName)) {
        index.set(normalizedName, entry);
      }
    }
  }

  return index;
}

function findGencEntry(
  row: CountryCodeOverlayRow,
  gencByAlpha3: Map<string, GencCountryCodeEntry>,
  gencByName: Map<string, GencCountryCodeEntry>,
) {
  if (row.primaryAlpha3) {
    const codeMatch = gencByAlpha3.get(row.primaryAlpha3);

    if (codeMatch) {
      return codeMatch;
    }
  }

  for (const name of [row.displayName, ...row.alternativeNames]) {
    const nameMatch = gencByName.get(normalizeName(name));

    if (nameMatch) {
      return nameMatch;
    }
  }

  return null;
}

function getExactLegacyFipsRog3Fallback(
  row: CountryCodeOverlayRow,
  fipsByName: Map<string, LegacyFipsCountryCodeEntry>,
) {
  if (!row.fips) {
    return null;
  }

  const fips = fipsByName.get(normalizeName(row.displayName));
  return fips?.code === row.fips ? row.fips : null;
}

function resolveRog3Code(
  row: CountryCodeOverlayRow,
  rog3ByCode: Map<string, Rog3CountryCodeEntry>,
  rog3ByGencAlpha3: Map<string, Rog3CountryCodeEntry>,
  rog3ByName: Map<string, Rog3CountryCodeEntry>,
  fipsByName: Map<string, LegacyFipsCountryCodeEntry>,
) {
  if (row.fips) {
    const codeMatch = rog3ByCode.get(row.fips);

    if (codeMatch) {
      return codeMatch.rog3;
    }
  }

  const displayNameMatch = rog3ByName.get(normalizeName(row.displayName));

  if (displayNameMatch) {
    return (
      displayNameMatch.rog3 ?? getExactLegacyFipsRog3Fallback(row, fipsByName)
    );
  }

  if (row.fips) {
    for (const name of row.alternativeNames) {
      const aliasMatch = rog3ByName.get(normalizeName(name));

      if (aliasMatch) {
        return aliasMatch.rog3 ?? getExactLegacyFipsRog3Fallback(row, fipsByName);
      }
    }
  }

  if (row.primaryAlpha3) {
    const gencMatch = rog3ByGencAlpha3.get(row.primaryAlpha3);

    if (gencMatch) {
      return gencMatch.rog3 ?? getExactLegacyFipsRog3Fallback(row, fipsByName);
    }
  }

  return row.fips;
}

function buildUntermNamesByAlpha3(
  untermEntries: UntermCountryNameEntry[],
  m49Entries: M49CountryCodeEntry[],
) {
  const untermByName = buildNameIndex(untermEntries, (entry) => [
    entry.englishShortName,
  ]);
  const untermByAlpha3 = new Map<string, UntermCountryNameEntry>();

  for (const m49Entry of m49Entries) {
    const untermEntry = untermByName.get(normalizeName(m49Entry.countryOrArea));

    if (untermEntry && !untermByAlpha3.has(m49Entry.alpha3)) {
      untermByAlpha3.set(m49Entry.alpha3, untermEntry);
    }
  }

  return untermByAlpha3;
}

function isCanonicalOfficialRow(
  row: CountryCodeOverlayRow,
  official: OfficialIsoCountryCodeEntry | undefined,
  duplicatePrimaryAlpha3: boolean,
  activePrimaryAlpha3Count: number,
) {
  if (!official) {
    return false;
  }

  if (!duplicatePrimaryAlpha3) {
    return true;
  }

  const officialName = normalizeName(official.englishShortName);

  if (normalizeName(row.displayName) === officialName) {
    return true;
  }

  return (
    row.active &&
    activePrimaryAlpha3Count === 1 &&
    row.alternativeNames.some((name) => normalizeName(name) === officialName)
  );
}

function classifyCountryCodeRow(input: {
  row: CountryCodeOverlayRow;
  official: OfficialIsoCountryCodeEntry | undefined;
  genc: GencCountryCodeEntry | null;
  fips: LegacyFipsCountryCodeEntry | undefined;
  duplicatePrimaryAlpha3: boolean;
  canonicalOfficial: boolean;
}): CountryCodeClassification {
  if (input.official && input.duplicatePrimaryAlpha3 && !input.canonicalOfficial) {
    return "duplicate-iso-territory";
  }

  if (input.official) {
    return "iso-official";
  }

  if (
    input.row.primaryAlpha3 &&
    input.genc &&
    input.row.primaryAlpha3 !== input.genc.alpha3
  ) {
    return "non-official-code";
  }

  if (input.genc) {
    return "genc-supported";
  }

  if (input.row.fips || input.fips) {
    return "legacy-fips-only";
  }

  return "csv-only";
}

export function buildIsoCountryCodeResource(input: BuildIsoCountryCodeResourceInput) {
  validateOfficialIsoCountryCodeEntries(input.officialEntries);
  validateGencCountryCodeEntries(input.gencEntries);
  validateLegacyFipsCountryCodeEntries(input.fipsEntries);
  validateRog3CountryCodeEntries(input.rog3Entries);
  validateUntermCountryNameEntries(input.untermEntries);
  validateM49CountryCodeEntries(input.m49Entries);
  validateCountryCodeOverlayRows(
    input.overlayRows,
    input.expectedOverlayCount,
    input.expectedActiveCount,
  );

  const officialByAlpha3 = new Map(
    input.officialEntries.map((entry) => [entry.alpha3, entry]),
  );
  const gencByAlpha3 = new Map(input.gencEntries.map((entry) => [entry.alpha3, entry]));
  const gencByName = buildNameIndex(input.gencEntries, (entry) => [
    entry.preferredName,
    entry.gencName,
  ]);
  const rog3ByCode = new Map(
    input.rog3Entries.flatMap((entry) => (entry.rog3 ? [[entry.rog3, entry]] : [])),
  );
  const rog3ByGencAlpha3 = new Map(
    input.rog3Entries.map((entry) => [entry.gencAlpha3, entry]),
  );
  const rog3ByName = buildNameIndex(input.rog3Entries, (entry) => [
    entry.name,
    entry.shortName,
    entry.fullName,
  ]);
  const untermByAlpha3 = buildUntermNamesByAlpha3(
    input.untermEntries,
    input.m49Entries,
  );
  const fipsByCode = new Map(input.fipsEntries.map((entry) => [entry.code, entry]));
  const fipsByName = buildNameIndex(input.fipsEntries, (entry) => [entry.name]);
  const primaryAlpha3Counts = getPrimaryAlpha3Counts(input.overlayRows);
  const activePrimaryAlpha3Counts = getActivePrimaryAlpha3Counts(input.overlayRows);

  const entries = input.overlayRows.map((row) => {
    const official = row.primaryAlpha3
      ? officialByAlpha3.get(row.primaryAlpha3)
      : undefined;
    const unterm = row.primaryAlpha3
      ? untermByAlpha3.get(row.primaryAlpha3)
      : undefined;
    const genc = findGencEntry(row, gencByAlpha3, gencByName);
    const rog3 = resolveRog3Code(
      row,
      rog3ByCode,
      rog3ByGencAlpha3,
      rog3ByName,
      fipsByName,
    );
    const fips = row.fips ? fipsByCode.get(row.fips) : undefined;
    const duplicatePrimaryAlpha3 = row.primaryAlpha3
      ? (primaryAlpha3Counts.get(row.primaryAlpha3) ?? 0) > 1
      : false;
    const canonicalOfficial = isCanonicalOfficialRow(
      row,
      official,
      duplicatePrimaryAlpha3,
      row.primaryAlpha3 ? (activePrimaryAlpha3Counts.get(row.primaryAlpha3) ?? 0) : 0,
    );
    const classification = classifyCountryCodeRow({
      row,
      official,
      genc,
      fips,
      duplicatePrimaryAlpha3,
      canonicalOfficial,
    });

    return {
      displayName: row.displayName,
      active: row.active,
      primaryAlpha3: row.primaryAlpha3,
      officialIsoAlpha2: official?.alpha2 ?? null,
      officialIsoAlpha3: official?.alpha3 ?? null,
      officialIsoNumeric: official?.numeric ?? null,
      untermEnglishShortName: unterm?.englishShortName ?? null,
      untermEnglishFormalName: unterm?.englishFormalName ?? null,
      untermNameSource: unterm ? "unterm-m49" : null,
      gencAlpha2: genc?.alpha2 ?? null,
      gencAlpha3: genc?.alpha3 ?? null,
      gencNumeric: genc?.numeric ?? null,
      fips: row.fips,
      rog3,
      alternativeNames: row.alternativeNames,
      classification,
      sourceUri: official?.uri ?? null,
    } satisfies IsoCountryCodeEntry;
  });

  const resource = {
    sourceName:
      "ISO OBP, UNTERM, UNSD M49, GENC, legacy FIPS, ROG3/GEC crosswalk, and curated Accelerate Global overlay",
    sourceUrl: ISO_COUNTRY_CODES_SOURCE_URL,
    sourceCollectionUrl: ISO_COUNTRY_CODES_COLLECTION_URL,
    gencSourceUrl: GENC_COUNTRY_CODES_SOURCE_URL,
    gencAboutUrl: GENC_COUNTRY_CODES_ABOUT_URL,
    fipsSourceUrl: LEGACY_FIPS_COUNTRY_CODES_SOURCE_URL,
    fipsWithdrawalUrl: FIPS_WITHDRAWAL_SOURCE_URL,
    rog3SourceUrl: ROG3_COUNTRY_CODES_SOURCE_URL,
    rog3HisRegistryUrl: ROG3_HIS_REGISTRY_URL,
    rog3HisCrossReferenceUrl: ROG3_HIS_CROSS_REFERENCE_URL,
    untermSourceUrl: UNTERM_COUNTRY_NAMES_SOURCE_URL,
    m49SourceUrl: M49_COUNTRY_CODES_SOURCE_URL,
    overlaySourceName: COUNTRY_CODE_OVERLAY_SOURCE_NAME,
    sourceRetrievedAt: input.sourceRetrievedAt ?? new Date().toISOString(),
    entryCount: entries.length,
    officialIsoCount: input.officialEntries.length,
    activeCount: entries.filter((entry) => entry.active).length,
    entries,
  } satisfies IsoCountryCodeResource;

  validateIsoCountryCodeResource(resource);

  return resource;
}

export function validateIsoCountryCodeResource(resource: IsoCountryCodeResource) {
  if (resource.entryCount !== resource.entries.length) {
    throw new Error("Generated country-code entry count is stale.");
  }

  if (resource.activeCount !== resource.entries.filter((entry) => entry.active).length) {
    throw new Error("Generated country-code active count is stale.");
  }

  if (resource.officialIsoCount < ISO_COUNTRY_CODES_MINIMUM_COUNT) {
    throw new Error("Generated official ISO country-code count is stale.");
  }

  for (const entry of resource.entries) {
    assertString(entry.displayName, "display name");

    if (entry.primaryAlpha3 && !/^[A-Z0-9]{3}$/.test(entry.primaryAlpha3)) {
      throw new Error(`Invalid primary alpha-3 code for ${entry.displayName}.`);
    }

    if (entry.officialIsoAlpha2 && !/^[A-Z]{2}$/.test(entry.officialIsoAlpha2)) {
      throw new Error(`Invalid official ISO alpha-2 code for ${entry.displayName}.`);
    }

    if (entry.officialIsoAlpha3 && !/^[A-Z]{3}$/.test(entry.officialIsoAlpha3)) {
      throw new Error(`Invalid official ISO alpha-3 code for ${entry.displayName}.`);
    }

    if (entry.officialIsoNumeric && !/^\d{3}$/.test(entry.officialIsoNumeric)) {
      throw new Error(`Invalid official ISO numeric code for ${entry.displayName}.`);
    }

    if (entry.untermNameSource !== null && entry.untermNameSource !== "unterm-m49") {
      throw new Error(`Invalid UNTERM name source for ${entry.displayName}.`);
    }

    if (entry.untermNameSource && !entry.untermEnglishShortName) {
      throw new Error(`UNTERM fields are incomplete for ${entry.displayName}.`);
    }

    if (
      !entry.untermNameSource &&
      (entry.untermEnglishShortName || entry.untermEnglishFormalName)
    ) {
      throw new Error(`UNTERM source is missing for ${entry.displayName}.`);
    }

    if (entry.gencAlpha2 && !/^[A-Z0-9]{2}$/.test(entry.gencAlpha2)) {
      throw new Error(`Invalid GENC alpha-2 code for ${entry.displayName}.`);
    }

    if (entry.gencAlpha3 && !/^[A-Z0-9]{3}$/.test(entry.gencAlpha3)) {
      throw new Error(`Invalid GENC alpha-3 code for ${entry.displayName}.`);
    }

    if (entry.gencNumeric && !/^\d{3}$/.test(entry.gencNumeric)) {
      throw new Error(`Invalid GENC numeric code for ${entry.displayName}.`);
    }

    if (entry.fips && !/^[A-Z]{2}$/.test(entry.fips)) {
      throw new Error(`Invalid FIPS code for ${entry.displayName}.`);
    }

    if (entry.rog3 && !/^[A-Z]{2}$/.test(entry.rog3)) {
      throw new Error(`Invalid ROG3 code for ${entry.displayName}.`);
    }

    if (!CLASSIFICATIONS.has(entry.classification)) {
      throw new Error(`Invalid classification for ${entry.displayName}.`);
    }

    if (entry.alternativeNames.some((name) => name.trim().length === 0)) {
      throw new Error(`Invalid empty alias for ${entry.displayName}.`);
    }
  }
}

export function getGeneratedIsoCountryCodeResource(): IsoCountryCodeResource {
  const resource = generatedIsoCountryCodes as IsoCountryCodeResource;
  validateIsoCountryCodeResource(resource);
  return resource;
}

export function applyIsoCountryCodeEntryOverrides(
  resource: IsoCountryCodeResource,
  overrides: IsoCountryCodeEntryOverride[],
) {
  if (overrides.length === 0) {
    return resource;
  }

  const overridesByDisplayName = new Map(
    overrides.map((override) => [
      override.displayName,
      normalizeCountryCodeAlternativeNames(
        override.displayName,
        override.alternativeNames,
      ),
    ]),
  );

  const nextResource = {
    ...resource,
    entries: resource.entries.map((entry) => {
      const alternativeNames = overridesByDisplayName.get(entry.displayName);

      if (!alternativeNames) {
        return entry;
      }

      return {
        ...entry,
        alternativeNames,
      };
    }),
  } satisfies IsoCountryCodeResource;

  validateIsoCountryCodeResource(nextResource);
  return nextResource;
}

export async function listIsoCountryCodeEntryOverrides() {
  return getDb()
    .select({
      displayName: isoCountryCodeEntryOverrides.displayName,
      alternativeNames: isoCountryCodeEntryOverrides.alternativeNames,
    })
    .from(isoCountryCodeEntryOverrides);
}

export async function mergeIsoCountryCodeEntryOverrides(
  resource: IsoCountryCodeResource,
) {
  const overrides = await listIsoCountryCodeEntryOverrides();
  return applyIsoCountryCodeEntryOverrides(resource, overrides);
}

export async function getGeneratedIsoCountryCodeResourceWithOverrides() {
  return mergeIsoCountryCodeEntryOverrides(getGeneratedIsoCountryCodeResource());
}

function getSetCookies(headers: Headers) {
  const maybeGetSetCookie = (
    headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie;

  if (typeof maybeGetSetCookie === "function") {
    return maybeGetSetCookie.call(headers);
  }

  const cookieHeader = headers.get("set-cookie");
  return cookieHeader ? cookieHeader.split(/,(?=\s*[^;,]+=)/) : [];
}

function mergeCookies(currentCookies: Map<string, string>, headers: Headers) {
  for (const cookie of getSetCookies(headers)) {
    const [nameValue] = cookie.split(";");
    const separatorIndex = nameValue.indexOf("=");

    if (separatorIndex > 0) {
      currentCookies.set(
        nameValue.slice(0, separatorIndex).trim(),
        nameValue.slice(separatorIndex + 1).trim(),
      );
    }
  }
}

function serializeCookies(cookies: Map<string, string>) {
  return [...cookies.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function getBrowserDetailsBody() {
  const now = Date.now();
  const body = new URLSearchParams({
    "v-browserDetails": "1",
    theme: "iso-red",
    "v-appId": "obpui-105541713",
    browserDetails: "1",
    screenWidth: "1280",
    screenHeight: "720",
    windowWidth: "1280",
    windowHeight: "720",
    "v-loc": ISO_COUNTRY_CODES_SOURCE_URL,
    "v-wn": "obpui-105541713",
    "v-tzo": "0",
    "v-dstd": "0",
    "v-rtzo": "0",
    "v-dston": "false",
    "v-vw": "1280",
    "v-vh": "720",
    "v-sw": "1280",
    "v-sh": "720",
    "v-cw": "1280",
    "v-ch": "720",
    "v-curdate": String(now),
    "v-tzoffset": "0",
  });

  return { body, now };
}

function parseInitialVaadinMessage(text: string): VaadinMessage {
  const parsed = JSON.parse(text) as { uidl?: string };

  if (typeof parsed.uidl !== "string") {
    throw new Error("ISO OBP initial response did not include UIDL.");
  }

  return JSON.parse(parsed.uidl) as VaadinMessage;
}

function parseVaadinMessages(text: string): VaadinMessage[] {
  return JSON.parse(text.replace(/^for\(;;\);/, "")) as VaadinMessage[];
}

function getRpcEntries(message: VaadinMessage) {
  return Array.isArray(message.rpc) ? message.rpc : [];
}

function readIsoRows(message: VaadinMessage) {
  const entries: OfficialIsoCountryCodeEntry[] = [];

  for (const rpc of getRpcEntries(message)) {
    if (!Array.isArray(rpc) || rpc[2] !== "setData") {
      continue;
    }

    const rows = (rpc[3] as unknown[])?.[1];

    if (!Array.isArray(rows)) {
      continue;
    }

    for (const row of rows) {
      const data = (row as { d?: Record<string, unknown> }).d;

      if (
        !data ||
        data[GRID_FIELD_IDS.codeType] !== "country" ||
        data[GRID_FIELD_IDS.status] !== "Officially assigned"
      ) {
        continue;
      }

      entries.push({
        alpha2: assertString(data[GRID_FIELD_IDS.alpha2], "alpha-2 code"),
        alpha3: assertString(data[GRID_FIELD_IDS.alpha3], "alpha-3 code"),
        englishShortName: assertString(
          data[GRID_FIELD_IDS.englishShortName],
          "English short name",
        ),
        numeric: assertString(data[GRID_FIELD_IDS.numeric], "numeric code"),
        uri: assertString(data[GRID_FIELD_IDS.uri], "source URI"),
      });
    }
  }

  return entries;
}

function getCountryDataConnectorId(message: VaadinMessage) {
  for (const rpc of getRpcEntries(message)) {
    if (!Array.isArray(rpc) || rpc[2] !== "setData") {
      continue;
    }

    const rows = (rpc[3] as unknown[])?.[1];

    if (
      Array.isArray(rows) &&
      rows.some((row) => {
        const data = (row as { d?: Record<string, unknown> }).d;
        return (
          data?.[GRID_FIELD_IDS.codeType] === "country" &&
          data?.[GRID_FIELD_IDS.status] === "Officially assigned"
        );
      })
    ) {
      return String(rpc[0]);
    }
  }

  return null;
}

function findEnabledNextButtonId(message: VaadinMessage) {
  const state = message.state ?? {};
  const nextButtonIds = Object.entries(state)
    .filter(([, value]) => value.caption === "Next" && value.enabled !== false)
    .map(([id]) => Number(id))
    .filter((id) => Number.isFinite(id));

  if (nextButtonIds.length === 0) {
    return null;
  }

  return String(Math.max(...nextButtonIds));
}

function createClickPayload(input: {
  csrfToken: string;
  buttonId: string;
  syncId: number;
  clientId: number;
}) {
  return JSON.stringify({
    csrfToken: input.csrfToken,
    rpc: [
      [
        input.buttonId,
        "com.vaadin.shared.ui.button.ButtonServerRpc",
        "click",
        [
          {
            altKey: false,
            button: "LEFT",
            clientX: 0,
            clientY: 0,
            ctrlKey: false,
            metaKey: false,
            relativeX: 0,
            relativeY: 0,
            shiftKey: false,
            type: 1,
          },
        ],
      ],
    ],
    syncId: input.syncId,
    clientId: input.clientId,
  });
}

function createRowsPayload(input: {
  csrfToken: string;
  dataConnectorId: string;
  syncId: number;
  clientId: number;
}) {
  return JSON.stringify({
    csrfToken: input.csrfToken,
    rpc: [
      [
        input.dataConnectorId,
        "com.vaadin.shared.data.DataCommunicatorServerRpc",
        "requestRows",
        [0, 25, 0, 2],
      ],
    ],
    syncId: input.syncId,
    clientId: input.clientId,
  });
}

async function fetchWithCookies(input: {
  url: string;
  cookies: Map<string, string>;
  init?: RequestInit;
}) {
  const response = await fetch(input.url, {
    ...input.init,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; AccelerateGlobalCountryCodeRefresh/1.0)",
      Accept: "application/json,text/html,*/*",
      Cookie: serializeCookies(input.cookies),
      ...input.init?.headers,
    },
  });

  mergeCookies(input.cookies, response.headers);

  if (!response.ok) {
    throw new Error(`ISO OBP request failed with ${response.status}.`);
  }

  return response.text();
}

async function fetchTextSource(url: string, label: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; AccelerateGlobalCountryCodeRefresh/1.0)",
      Accept: "text/plain,text/html,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`${label} request failed with ${response.status}.`);
  }

  return response.text();
}

async function fetchBinarySource(url: string, label: string) {
  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AccelerateGlobalCountryCodeRefresh/1.0)",
        Accept:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*",
      },
    });
  } catch (error) {
    if (url !== ROG3_COUNTRY_CODES_SOURCE_URL) {
      throw error;
    }

    const { stdout } = await execFileAsync(
      "curl",
      ["--location", "--fail", "--silent", "--show-error", url],
      {
        encoding: "buffer",
        maxBuffer: 10 * 1024 * 1024,
      },
    );
    return stdout.buffer.slice(
      stdout.byteOffset,
      stdout.byteOffset + stdout.byteLength,
    );
  }

  if (!response.ok) {
    throw new Error(`${label} request failed with ${response.status}.`);
  }

  return response.arrayBuffer();
}

export async function refreshOfficialIsoCountryCodeEntriesFromOfficialSource() {
  const cookies = new Map<string, string>();

  await fetchWithCookies({
    url: "https://www.iso.org/obp/ui/",
    cookies,
  });

  const { body, now } = getBrowserDetailsBody();
  let message = parseInitialVaadinMessage(
    await fetchWithCookies({
      url: `https://www.iso.org/obp/ui/?v-${now}`,
      cookies,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body,
      },
    }),
  );

  const csrfToken = message["Vaadin-Security-Key"];
  const dataConnectorId = getCountryDataConnectorId(message);

  if (!csrfToken || dataConnectorId === null) {
    throw new Error("ISO OBP response did not include refresh session metadata.");
  }

  const entriesByAlpha2 = new Map<string, OfficialIsoCountryCodeEntry>();
  let syncId = message.syncId ?? 0;
  let clientId = message.clientId ?? 0;

  function addEntries(nextEntries: OfficialIsoCountryCodeEntry[]) {
    for (const entry of nextEntries) {
      entriesByAlpha2.set(entry.alpha2, entry);
    }
  }

  addEntries(readIsoRows(message));

  for (let page = 0; page < 20; page += 1) {
    const nextButtonId = findEnabledNextButtonId(message);

    if (!nextButtonId) {
      break;
    }

    const clickMessages = parseVaadinMessages(
      await fetchWithCookies({
        url: "https://www.iso.org/obp/ui/UIDL/?v-uiId=0",
        cookies,
        init: {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=UTF-8",
          },
          body: createClickPayload({
            csrfToken,
            buttonId: nextButtonId,
            syncId,
            clientId,
          }),
        },
      }),
    );

    message = clickMessages[0] ?? {};
    syncId = message.syncId ?? syncId;
    clientId = message.clientId ?? clientId;

    const rowRequestPayload = createRowsPayload({
      csrfToken,
      dataConnectorId,
      syncId,
      clientId,
    });
    let rowMessages = parseVaadinMessages(
      await fetchWithCookies({
        url: "https://www.iso.org/obp/ui/UIDL/?v-uiId=0",
        cookies,
        init: {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=UTF-8",
          },
          body: rowRequestPayload,
        },
      }),
    );

    if (readIsoRows(rowMessages[0] ?? {}).length === 0) {
      rowMessages = parseVaadinMessages(
        await fetchWithCookies({
          url: "https://www.iso.org/obp/ui/UIDL/?v-uiId=0",
          cookies,
          init: {
            method: "POST",
            headers: {
              "Content-Type": "application/json; charset=UTF-8",
            },
            body: rowRequestPayload,
          },
        }),
      );
    }

    message = rowMessages[0] ?? {};
    syncId = message.syncId ?? syncId;
    clientId = message.clientId ?? clientId;
    addEntries(readIsoRows(message));
  }

  const entries = [...entriesByAlpha2.values()];
  validateOfficialIsoCountryCodeEntries(entries);
  return entries;
}

export function parseGencCountryCodeEntries(text: string) {
  const parsed = Papa.parse<Record<string, string>>(text, {
    delimiter: "\t",
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    throw new Error(`Could not parse GENC source: ${parsed.errors[0].message}`);
  }

  const entries = parsed.data.map((row) => ({
    ncitCode: assertString(row["NCIt Concept Code"], "NCIt concept code"),
    preferredName: assertString(row["NCIt Preferred Term"], "NCIt preferred term"),
    gencName: assertString(row["GENC Name (FDA Standard)"], "GENC name"),
    alpha2: nullableCode(row["GENC 2 Letter Code"]),
    alpha3: assertString(
      row["GENC 3 Letter Code (FDA Standard)"],
      "GENC alpha-3 code",
    ).toUpperCase(),
    numeric: assertString(row["GENC Number"], "GENC numeric code"),
  }));

  validateGencCountryCodeEntries(entries);
  return entries;
}

export async function fetchGencCountryCodeEntriesFromSource() {
  const text = await fetchTextSource(GENC_COUNTRY_CODES_SOURCE_URL, "GENC");
  return parseGencCountryCodeEntries(text);
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export function parseLegacyFipsCountryCodeEntries(text: string) {
  const entries = [...text.matchAll(/<tr><td>([A-Z]{2})<\/td><td>(.*?)<\/td><\/tr>/g)]
    .map((match) => ({
      code: match[1],
      name: decodeHtmlEntities(match[2]).trim(),
    }))
    .filter((entry) => entry.name.length > 0);

  validateLegacyFipsCountryCodeEntries(entries);
  return entries;
}

export async function fetchLegacyFipsCountryCodeEntriesFromSource() {
  const text = await fetchTextSource(
    LEGACY_FIPS_COUNTRY_CODES_SOURCE_URL,
    "Legacy FIPS",
  );
  return parseLegacyFipsCountryCodeEntries(text);
}

export async function fetchRog3CountryCodeEntriesFromSource() {
  const workbook = await fetchBinarySource(ROG3_COUNTRY_CODES_SOURCE_URL, "ROG3");
  return parseRog3CountryCodeEntriesWorkbook(workbook);
}

export async function fetchUntermCountryNameEntriesFromSource() {
  const workbook = await fetchBinarySource(
    UNTERM_COUNTRY_NAMES_SOURCE_URL,
    "UNTERM",
  );
  return parseUntermCountryNamesWorkbook(workbook);
}

export async function fetchM49CountryCodeEntriesFromSource() {
  const html = await fetchTextSource(M49_COUNTRY_CODES_SOURCE_URL, "M49");
  return parseM49CountryCodeEntries(html);
}

export async function refreshIsoCountryCodeResourceFromOfficialSource() {
  const [
    officialEntries,
    gencEntries,
    fipsEntries,
    rog3Entries,
    untermEntries,
    m49Entries,
    overlayRows,
  ] =
    await Promise.all([
      refreshOfficialIsoCountryCodeEntriesFromOfficialSource(),
      fetchGencCountryCodeEntriesFromSource(),
      fetchLegacyFipsCountryCodeEntriesFromSource(),
      fetchRog3CountryCodeEntriesFromSource(),
      fetchUntermCountryNameEntriesFromSource(),
      fetchM49CountryCodeEntriesFromSource(),
      readCountryCodeOverlayRows(),
    ]);

  return buildIsoCountryCodeResource({
    officialEntries,
    gencEntries,
    fipsEntries,
    rog3Entries,
    untermEntries,
    m49Entries,
    overlayRows,
  });
}
