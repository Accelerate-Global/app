import type { InferInsertModel } from "drizzle-orm";

import {
  countryReferenceEntries,
  ropReferenceGeographies,
  ropReferencePeople,
  ropReferenceTerms,
} from "@/db/schema";
import {
  validateIsoCountryCodeResource,
  type IsoCountryCodeEntry,
  type IsoCountryCodeResource,
} from "@/lib/iso-country-codes";
import type {
  RopCodeEntry,
  RopCodeResource,
  RopGeoIndexEntry,
  RopTermDetail,
} from "@/lib/rop-codes";

import { canonicalizeReferenceResource } from "./canonical";
import {
  COUNTRY_RESOURCE_KEY,
  type ReferenceResourceDiffSummary,
  type ReferenceResourceKey,
  type ReferenceResourcePayloadByKey,
} from "./types";

type CountryProjection = Omit<
  InferInsertModel<typeof countryReferenceEntries>,
  "id" | "versionId" | "createdAt"
>;
type RopTermProjection = Omit<
  InferInsertModel<typeof ropReferenceTerms>,
  "id" | "versionId" | "createdAt"
>;
type RopPersonProjection = Omit<
  InferInsertModel<typeof ropReferencePeople>,
  "id" | "versionId" | "createdAt"
>;
type RopGeographyProjection = Omit<
  InferInsertModel<typeof ropReferenceGeographies>,
  "id" | "versionId" | "createdAt"
>;

export type PreparedReferenceResource = {
  sourceRetrievedAt: Date;
  sourceMetadata: Record<string, unknown>;
  entryCount: number;
  stableEntries: Map<string, unknown>;
  countryEntries: CountryProjection[];
  ropTerms: RopTermProjection[];
  ropPeople: RopPersonProjection[];
  ropGeographies: RopGeographyProjection[];
  csv: string;
};

export const COUNTRY_CSV_COLUMNS = [
  "Country/Territory",
  "Status",
  "ISO3",
  "ISO2",
  "Numeric",
  "Official UN short name",
  "Official UN formal name",
  "Official name source",
  "FIPS",
  "ROG3",
  "GENC3",
  "GENC2",
  "GENC numeric",
  "Classification",
  "Alternative names",
  "Source URI",
] as const;

export const ROP_CSV_COLUMNS = [
  "ROP1",
  "ROP2",
  "ROP25",
  "ROP3",
  "Status",
  "Row type",
  "Join issue",
  "Place",
  "Language",
  "Source",
  "Ethnic ID",
] as const;

function escapeCsvValue(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function buildCsv(headers: readonly string[], rows: unknown[][]) {
  return `${[
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => row.map(escapeCsvValue).join(",")),
  ].join("\n")}\n`;
}

export function serializeCountryCsvRows(
  entries: IsoCountryCodeEntry[],
  options: { includeHeader?: boolean } = {},
) {
  const csv = buildCsv(
    COUNTRY_CSV_COLUMNS,
    entries.map((entry) => [
      entry.displayName,
      entry.active ? "Active" : "Inactive",
      entry.primaryAlpha3,
      entry.officialIsoAlpha2,
      entry.officialIsoNumeric,
      entry.untermEnglishShortName,
      entry.untermEnglishFormalName,
      entry.untermNameSource,
      entry.fips,
      entry.rog3,
      entry.gencAlpha3,
      entry.gencAlpha2,
      entry.gencNumeric,
      entry.classification,
      entry.alternativeNames.join("; "),
      entry.sourceUri,
    ]),
  );
  return options.includeHeader === false ? csv.slice(csv.indexOf("\n") + 1) : csv;
}

export function serializeRopCsvRows(
  entries: RopCodeEntry[],
  options: { includeHeader?: boolean } = {},
) {
  const csv = buildCsv(
    ROP_CSV_COLUMNS,
    entries.map((entry) => [
      entry.rop1?.display,
      entry.rop2?.display,
      entry.rop25?.display,
      entry.rop3?.display,
      entry.status,
      entry.rowType,
      entry.joinIssueLabel,
      entry.place,
      entry.language,
      entry.source,
      entry.ethnicId,
    ]),
  );
  return options.includeHeader === false ? csv.slice(csv.indexOf("\n") + 1) : csv;
}

export function getCountryStableKey(entry: IsoCountryCodeEntry) {
  const code =
    entry.sourceUri ??
    entry.primaryAlpha3 ??
    entry.officialIsoAlpha3 ??
    entry.gencAlpha3 ??
    "none";
  return `${code}:${entry.displayName.toLocaleLowerCase()}`;
}

function countrySearchText(entry: IsoCountryCodeEntry) {
  return [
    entry.displayName,
    entry.active ? "active" : "inactive",
    entry.primaryAlpha3,
    entry.officialIsoAlpha2,
    entry.officialIsoAlpha3,
    entry.officialIsoNumeric,
    entry.untermEnglishShortName,
    entry.untermEnglishFormalName,
    entry.untermNameSource,
    entry.gencAlpha2,
    entry.gencAlpha3,
    entry.gencNumeric,
    entry.fips,
    entry.rog3,
    entry.classification,
    entry.sourceUri,
    ...entry.alternativeNames,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

function prepareCountry(resource: IsoCountryCodeResource): PreparedReferenceResource {
  validateIsoCountryCodeResource(resource);
  const countryEntries = resource.entries.map((entry) => ({
    stableKey: getCountryStableKey(entry),
    displayName: entry.displayName,
    active: entry.active,
    primaryAlpha3: entry.primaryAlpha3,
    officialIsoAlpha2: entry.officialIsoAlpha2,
    officialIsoAlpha3: entry.officialIsoAlpha3,
    officialIsoNumeric: entry.officialIsoNumeric,
    untermEnglishShortName: entry.untermEnglishShortName,
    untermEnglishFormalName: entry.untermEnglishFormalName,
    untermNameSource: entry.untermNameSource,
    gencAlpha2: entry.gencAlpha2,
    gencAlpha3: entry.gencAlpha3,
    gencNumeric: entry.gencNumeric,
    fips: entry.fips,
    rog3: entry.rog3,
    alternativeNames: entry.alternativeNames,
    classification: entry.classification,
    sourceUri: entry.sourceUri,
    searchText: countrySearchText(entry),
  }));
  if (new Set(countryEntries.map((entry) => entry.stableKey)).size !== countryEntries.length) {
    throw new Error("Country/ROG resource contains duplicate stable entry keys.");
  }

  return {
    sourceRetrievedAt: new Date(resource.sourceRetrievedAt),
    sourceMetadata: {
      sourceName: resource.sourceName,
      sourceUrl: resource.sourceUrl,
      sourceCollectionUrl: resource.sourceCollectionUrl,
      gencSourceUrl: resource.gencSourceUrl,
      fipsSourceUrl: resource.fipsSourceUrl,
      rog3SourceUrl: resource.rog3SourceUrl,
      untermSourceUrl: resource.untermSourceUrl,
      m49SourceUrl: resource.m49SourceUrl,
      overlaySourceName: resource.overlaySourceName,
    },
    entryCount: resource.entries.length,
    stableEntries: new Map(
      resource.entries.map((entry) => [getCountryStableKey(entry), entry]),
    ),
    countryEntries,
    ropTerms: [],
    ropPeople: [],
    ropGeographies: [],
    csv: serializeCountryCsvRows(resource.entries),
  };
}

function validateRopResource(resource: RopCodeResource) {
  if (resource.entries.length !== resource.entryCount || resource.entryCount < 13_000) {
    throw new Error("ROP resource entry count is invalid.");
  }
  if (
    Object.keys(resource.rop1DetailsByCode).length !== resource.rop1Count ||
    Object.keys(resource.rop2DetailsByCode).length !== resource.rop2Count ||
    Object.keys(resource.rop25DetailsByCode).length !== resource.rop25Count ||
    Object.keys(resource.rop3DetailsByCode).length !== resource.rop3Count
  ) {
    throw new Error("ROP resource term counts are invalid.");
  }
  const ids = new Set<string>();
  for (const entry of resource.entries) {
    if (!entry.id || ids.has(entry.id)) {
      throw new Error(`ROP resource contains duplicate entry ${entry.id}.`);
    }
    ids.add(entry.id);
    for (const level of ["rop1", "rop2", "rop25", "rop3"] as const) {
      const term = entry[level];
      const allowedMissingSourceTerm =
        (level === "rop25" && entry.joinIssue === "missing-rop25") ||
        (level === "rop2" && entry.joinIssue === "missing-rop2");
      if (
        term &&
        !resource[`${level}DetailsByCode`][term.code] &&
        !allowedMissingSourceTerm
      ) {
        throw new Error(`ROP resource is missing ${level.toUpperCase()} term ${term.code}.`);
      }
    }
    if (entry.rop2 && !entry.rop1 && entry.joinIssue !== "missing-rop2") {
      throw new Error(`ROP resource entry ${entry.id} is missing its ROP1 parent.`);
    }
    if (entry.rop25 && !entry.rop2) {
      throw new Error(`ROP resource entry ${entry.id} is missing its ROP2 parent.`);
    }
    if (entry.rop3 && !entry.rop25 && entry.joinIssue !== "missing-rop25") {
      throw new Error(`ROP resource entry ${entry.id} is missing its ROP25 parent.`);
    }
  }
  const geographyCount = Object.values(resource.geoIndexByRop3).reduce(
    (total, rows) => total + rows.length,
    0,
  );
  if (geographyCount !== resource.geoIndexCount) {
    throw new Error("ROP resource geography count is invalid.");
  }
  for (const [rop3, rows] of Object.entries(resource.geoIndexByRop3)) {
    if (!resource.rop3DetailsByCode[rop3] || rows.some((row) => row.rop3 !== rop3)) {
      throw new Error(`ROP resource geography index ${rop3} is inconsistent.`);
    }
  }
}

function termDisplay(entry: RopCodeEntry, level: "rop1" | "rop2" | "rop25" | "rop3") {
  return entry[level]?.display ?? "";
}

function flattenRopGeographies(resource: RopCodeResource) {
  return Object.values(resource.geoIndexByRop3).flat();
}

function buildRopTermProjections(resource: RopCodeResource) {
  const parents = {
    rop1: new Map<string, string | null>(),
    rop2: new Map<string, string | null>(),
    rop25: new Map<string, string | null>(),
    rop3: new Map<string, string | null>(),
  };
  const statuses = new Map<string, "Active" | "Inactive">();
  for (const entry of resource.entries) {
    if (entry.rop1) parents.rop1.set(entry.rop1.code, null);
    if (entry.rop2) parents.rop2.set(entry.rop2.code, entry.rop1?.code ?? null);
    if (entry.rop25) parents.rop25.set(entry.rop25.code, entry.rop2?.code ?? null);
    if (entry.rop3) {
      parents.rop3.set(entry.rop3.code, entry.rop25?.code ?? null);
      statuses.set(`rop3:${entry.rop3.code}`, entry.status);
    }
    if (entry.rowType === "rop25-parent" && entry.rop25) {
      statuses.set(`rop25:${entry.rop25.code}`, entry.status);
    }
  }

  const levels = ["rop1", "rop2", "rop25", "rop3"] as const;
  return levels.flatMap((level) =>
    Object.values(resource[`${level}DetailsByCode`]).map(
      (term: RopTermDetail): RopTermProjection => ({
        level,
        code: term.code,
        parentCode: parents[level].get(term.code) ?? null,
        name: term.name,
        description: term.description,
        status: statuses.get(`${level}:${term.code}`) ?? null,
      }),
    ),
  );
}

function geographySearchText(row: RopGeoIndexEntry) {
  return [
    row.geoId,
    row.rop3,
    row.rog,
    row.geoName,
    row.peopleName,
    row.peopleId3,
    row.isoAlpha3,
    row.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

function prepareRop(resource: RopCodeResource): PreparedReferenceResource {
  validateRopResource(resource);
  const geographyRows = flattenRopGeographies(resource);
  const geoSearchByRop3 = new Map<string, string[]>();
  for (const row of geographyRows) {
    const values = geoSearchByRop3.get(row.rop3) ?? [];
    values.push(geographySearchText(row));
    geoSearchByRop3.set(row.rop3, values);
  }
  const ropPeople = resource.entries.map((entry): RopPersonProjection => ({
    stableKey: entry.id,
    rowType: entry.rowType,
    rop1Code: entry.rop1?.code ?? null,
    rop2Code: entry.rop2?.code ?? null,
    rop25Code: entry.rop25?.code ?? null,
    rop3Code: entry.rop3?.code ?? null,
    status: entry.status,
    place: entry.place,
    language: entry.language,
    source: entry.source,
    ethnicId: entry.ethnicId,
    directRop2: entry.directRop2,
    joinIssue: entry.joinIssue,
    joinIssueLabel: entry.joinIssueLabel,
    searchText: [
      termDisplay(entry, "rop1"),
      termDisplay(entry, "rop2"),
      termDisplay(entry, "rop25"),
      termDisplay(entry, "rop3"),
      entry.status,
      entry.rowType,
      entry.joinIssue,
      entry.joinIssueLabel,
      entry.place,
      entry.language,
      entry.source,
      entry.ethnicId,
      ...(geoSearchByRop3.get(entry.rop3?.code ?? "") ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase(),
  }));

  return {
    sourceRetrievedAt: new Date(resource.sourceRetrievedAt),
    sourceMetadata: {
      sourceName: resource.sourceName,
      sourceUrl: resource.sourceUrl,
      featureServerUrl: resource.featureServerUrl,
      rop1Count: resource.rop1Count,
      rop2Count: resource.rop2Count,
      rop25Count: resource.rop25Count,
      rop3Count: resource.rop3Count,
      geoIndexCount: resource.geoIndexCount,
      joinIssueCounts: resource.joinIssueCounts,
    },
    entryCount: resource.entries.length,
    stableEntries: new Map(resource.entries.map((entry) => [entry.id, entry])),
    countryEntries: [],
    ropTerms: buildRopTermProjections(resource),
    ropPeople,
    ropGeographies: geographyRows.map((row): RopGeographyProjection => ({
      geoId: row.geoId,
      rop3Code: row.rop3,
      rog: row.rog,
      geoName: row.geoName,
      peopleName: row.peopleName,
      peopleId3: row.peopleId3,
      isoAlpha3: row.isoAlpha3,
      status: row.status,
      searchText: geographySearchText(row),
    })),
    csv: serializeRopCsvRows(resource.entries),
  };
}

export function prepareReferenceResource<K extends ReferenceResourceKey>(
  resourceKey: K,
  payload: ReferenceResourcePayloadByKey[K],
) {
  return resourceKey === COUNTRY_RESOURCE_KEY
    ? prepareCountry(payload as IsoCountryCodeResource)
    : prepareRop(payload as RopCodeResource);
}

export function getStableEntries(
  resourceKey: ReferenceResourceKey,
  payload: ReferenceResourcePayloadByKey[ReferenceResourceKey],
) {
  if (resourceKey === COUNTRY_RESOURCE_KEY) {
    const country = payload as IsoCountryCodeResource;
    return new Map(country.entries.map((entry) => [getCountryStableKey(entry), entry]));
  }
  const rop = payload as RopCodeResource;
  return new Map(rop.entries.map((entry) => [entry.id, entry]));
}

export function diffReferenceResources(input: {
  resourceKey: ReferenceResourceKey;
  previous: ReferenceResourcePayloadByKey[ReferenceResourceKey] | null;
  next: ReferenceResourcePayloadByKey[ReferenceResourceKey];
}) {
  const previous = input.previous
    ? getStableEntries(input.resourceKey, input.previous)
    : new Map<string, unknown>();
  const next = getStableEntries(input.resourceKey, input.next);
  const details: Array<{ key: string; change: "added" | "changed" | "removed" }> = [];
  let unchanged = 0;

  for (const [key, nextValue] of next) {
    const previousValue = previous.get(key);
    if (previousValue === undefined) {
      details.push({ key, change: "added" });
    } else if (
      canonicalizeReferenceResource(previousValue) !==
      canonicalizeReferenceResource(nextValue)
    ) {
      details.push({ key, change: "changed" });
    } else {
      unchanged += 1;
    }
  }
  for (const key of previous.keys()) {
    if (!next.has(key)) details.push({ key, change: "removed" });
  }

  const summary: ReferenceResourceDiffSummary = {
    added: details.filter((item) => item.change === "added").length,
    changed: details.filter((item) => item.change === "changed").length,
    removed: details.filter((item) => item.change === "removed").length,
    unchanged,
    highRisk: details.filter((item) => item.change === "removed").length,
  };
  return { summary, details };
}
