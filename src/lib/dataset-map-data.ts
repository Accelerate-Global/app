import type { FeatureCollection, Geometry } from "geojson";

import type { DatasetRowsResponse } from "@/lib/api-types";
import { DATASET_MAP_COUNTRY_NAME_ALIASES } from "@/lib/dataset-map-country-aliases";

export const DATASET_MAP_METRIC_LABEL = "matching records";
export const DEFAULT_DATASET_MAP_SEARCH_LIMIT = 12;

const ISO3_COLUMN_IDENTITIES = [
  "geo_iso3",
  "iso3",
  "country_iso3",
  "country_code_iso3",
] as const;
const COUNTRY_COLUMN_IDENTITIES = [
  "geo_country_name",
  "main_country_name",
  "country",
] as const;
const PEOPLE_GROUP_COLUMN_IDENTITIES = [
  "pg_name_main",
  "people_name",
  "pg_name",
  "people_group_name",
  "people_group_name_text",
  "peopnameacrosscountries",
] as const;

type DatasetRow = DatasetRowsResponse["rows"][number];

export type DatasetMapBoundaryProperties = {
  iso3: string;
  name: string;
};

export type DatasetMapBoundaryCollection = FeatureCollection<
  Geometry,
  DatasetMapBoundaryProperties
>;

export type DatasetMapUnmappedReason =
  | "missing-geography"
  | "unknown-iso3"
  | "ambiguous-country"
  | "unsupported-boundary";

export type DatasetMapPeopleGroup = {
  rowId: string;
  name: string;
};

export type DatasetMapRecordSummary = {
  rowId: string;
  name: string;
  sourceRowNumber: number;
};

export type DatasetMapCountryAggregate = {
  iso3: string;
  name: string;
  matchingRecordCount: number;
  peopleGroups: DatasetMapPeopleGroup[];
  records: DatasetMapRecordSummary[];
  sourceCountryNames: string[];
};

export type DatasetMapSearchEntry = {
  id: string;
  type: "country" | "people-group";
  label: string;
  countryIso3: string;
  countryName: string;
  rowId: string | null;
  searchText: string;
};

export type DatasetMapAggregation = {
  countries: DatasetMapCountryAggregate[];
  countryByIso3: ReadonlyMap<string, DatasetMapCountryAggregate>;
  searchEntries: DatasetMapSearchEntry[];
  mappedRecordCount: number;
  unmappedRecordCount: number;
  unmappedReasonCounts: Record<DatasetMapUnmappedReason, number>;
  metricLabel: typeof DATASET_MAP_METRIC_LABEL;
};

type DatasetMapRowFacets = {
  iso3: string;
  countryName: string;
  peopleGroupName: string;
};

type BoundaryIndex = {
  byIso3: Map<string, DatasetMapBoundaryProperties>;
  byName: Map<string, DatasetMapBoundaryProperties | null>;
  reviewedAliasIso3ByName: Map<string, string>;
};

type MutableCountryAggregate = {
  iso3: string;
  name: string;
  matchingRecordCount: number;
  peopleGroups: DatasetMapPeopleGroup[];
  records: DatasetMapRecordSummary[];
  sourceCountryNames: Set<string>;
};

const ISO3_COLUMN_PRIORITY = createIdentityPriority(ISO3_COLUMN_IDENTITIES);
const COUNTRY_COLUMN_PRIORITY = createIdentityPriority(COUNTRY_COLUMN_IDENTITIES);
const PEOPLE_GROUP_COLUMN_PRIORITY = createIdentityPriority(
  PEOPLE_GROUP_COLUMN_IDENTITIES,
);

function createIdentityPriority(values: readonly string[]) {
  return new Map(values.map((value, index) => [value, index] as const));
}
export function normalizeDatasetMapColumnIdentity(
  value: string | null | undefined,
) {
  return (
    value
      ?.trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "") ?? ""
  );
}

export function normalizeDatasetMapSearchText(
  value: string | null | undefined,
) {
  return (
    value
      ?.normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim() ?? ""
  );
}

function getDatasetMapRowFacets(row: DatasetRow): DatasetMapRowFacets {
  let iso3 = "";
  let countryName = "";
  let peopleGroupName = "";
  let iso3Priority = Number.POSITIVE_INFINITY;
  let countryPriority = Number.POSITIVE_INFINITY;
  let peopleGroupPriority = Number.POSITIVE_INFINITY;

  for (const [rawKey, rawValue] of Object.entries(row.data)) {
    const key = normalizeDatasetMapColumnIdentity(rawKey);
    const value = rawValue.trim();

    if (!value) {
      continue;
    }

    const nextIso3Priority = ISO3_COLUMN_PRIORITY.get(key);
    if (nextIso3Priority !== undefined && nextIso3Priority < iso3Priority) {
      iso3 = value;
      iso3Priority = nextIso3Priority;
    }

    const nextCountryPriority = COUNTRY_COLUMN_PRIORITY.get(key);
    if (
      nextCountryPriority !== undefined &&
      nextCountryPriority < countryPriority
    ) {
      countryName = value;
      countryPriority = nextCountryPriority;
    }

    const nextPeopleGroupPriority = PEOPLE_GROUP_COLUMN_PRIORITY.get(key);
    if (
      nextPeopleGroupPriority !== undefined &&
      nextPeopleGroupPriority < peopleGroupPriority
    ) {
      peopleGroupName = value;
      peopleGroupPriority = nextPeopleGroupPriority;
    }
  }

  return { iso3, countryName, peopleGroupName };
}

function createBoundaryIndex(
  boundaries: DatasetMapBoundaryCollection,
): BoundaryIndex {
  const byIso3 = new Map<string, DatasetMapBoundaryProperties>();
  const byName = new Map<string, DatasetMapBoundaryProperties | null>();

  for (const feature of boundaries.features) {
    const iso3 = feature.properties.iso3.trim().toUpperCase();
    const name = feature.properties.name.trim();

    if (!/^[A-Z]{3}$/.test(iso3) || !name || iso3 === "XXX") {
      continue;
    }

    const properties = { iso3, name } satisfies DatasetMapBoundaryProperties;
    byIso3.set(iso3, properties);

    const normalizedName = normalizeDatasetMapSearchText(name);
    const existingName = byName.get(normalizedName);
    byName.set(
      normalizedName,
      existingName === undefined || existingName?.iso3 === iso3
        ? properties
        : null,
    );
  }

  const reviewedAliasIso3ByName = new Map(
    Object.entries(DATASET_MAP_COUNTRY_NAME_ALIASES).map(([name, iso3]) => [
      normalizeDatasetMapSearchText(name),
      iso3,
    ]),
  );

  return { byIso3, byName, reviewedAliasIso3ByName };
}

function resolveBoundary(input: {
  facets: DatasetMapRowFacets;
  index: BoundaryIndex;
}):
  | { properties: DatasetMapBoundaryProperties; reason: null }
  | { properties: null; reason: DatasetMapUnmappedReason } {
  if (input.facets.iso3) {
    const iso3 = input.facets.iso3.trim().toUpperCase();

    if (!/^[A-Z]{3}$/.test(iso3) || iso3 === "XXX") {
      return { properties: null, reason: "unknown-iso3" };
    }

    const boundary = input.index.byIso3.get(iso3);
    return boundary
      ? { properties: boundary, reason: null }
      : { properties: null, reason: "unsupported-boundary" };
  }

  const normalizedCountryName = normalizeDatasetMapSearchText(
    input.facets.countryName,
  );

  if (!normalizedCountryName) {
    return { properties: null, reason: "missing-geography" };
  }

  const reviewedIso3 = input.index.reviewedAliasIso3ByName.get(
    normalizedCountryName,
  );
  if (reviewedIso3) {
    const reviewedBoundary = input.index.byIso3.get(reviewedIso3);
    return reviewedBoundary
      ? { properties: reviewedBoundary, reason: null }
      : { properties: null, reason: "unsupported-boundary" };
  }

  const boundary = input.index.byName.get(normalizedCountryName);

  if (boundary === null) {
    return { properties: null, reason: "ambiguous-country" };
  }

  return boundary
    ? { properties: boundary, reason: null }
    : { properties: null, reason: "unsupported-boundary" };
}

function createEmptyReasonCounts(): Record<DatasetMapUnmappedReason, number> {
  return {
    "missing-geography": 0,
    "unknown-iso3": 0,
    "ambiguous-country": 0,
    "unsupported-boundary": 0,
  };
}

export function aggregateDatasetMapRows(
  rows: readonly DatasetRow[],
  boundaries: DatasetMapBoundaryCollection,
): DatasetMapAggregation {
  const index = createBoundaryIndex(boundaries);
  const mutableCountries = new Map<string, MutableCountryAggregate>();
  const unmappedReasonCounts = createEmptyReasonCounts();
  let mappedRecordCount = 0;

  for (const row of rows) {
    const facets = getDatasetMapRowFacets(row);
    const resolved = resolveBoundary({ facets, index });

    if (!resolved.properties) {
      unmappedReasonCounts[resolved.reason] += 1;
      continue;
    }

    mappedRecordCount += 1;
    const { iso3, name } = resolved.properties;
    const current = mutableCountries.get(iso3) ?? {
      iso3,
      name,
      matchingRecordCount: 0,
      peopleGroups: [],
      records: [],
      sourceCountryNames: new Set<string>(),
    };

    current.matchingRecordCount += 1;
    current.records.push({
      rowId: row.id,
      name: facets.peopleGroupName || `Record ${row.rowIndex + 1}`,
      sourceRowNumber: row.rowIndex + 1,
    });
    if (facets.countryName) {
      current.sourceCountryNames.add(facets.countryName);
    }
    if (facets.peopleGroupName) {
      current.peopleGroups.push({
        rowId: row.id,
        name: facets.peopleGroupName,
      });
    }
    mutableCountries.set(iso3, current);
  }

  const countries = [...mutableCountries.values()]
    .map(
      (country) =>
        ({
          iso3: country.iso3,
          name: country.name,
          matchingRecordCount: country.matchingRecordCount,
          peopleGroups: [...country.peopleGroups].sort((left, right) =>
            left.name.localeCompare(right.name),
          ),
          records: [...country.records].sort((left, right) =>
            left.name.localeCompare(right.name, undefined, { numeric: true }),
          ),
          sourceCountryNames: [...country.sourceCountryNames].sort((left, right) =>
            left.localeCompare(right),
          ),
        }) satisfies DatasetMapCountryAggregate,
    )
    .sort((left, right) => left.name.localeCompare(right.name));
  const countryByIso3 = new Map(
    countries.map((country) => [country.iso3, country] as const),
  );
  const countrySearchEntries = countries.map(
    (country) =>
      ({
        id: `country:${country.iso3}`,
        type: "country",
        label: country.name,
        countryIso3: country.iso3,
        countryName: country.name,
        rowId: null,
        searchText: normalizeDatasetMapSearchText(
          [country.name, ...country.sourceCountryNames].join(" "),
        ),
      }) satisfies DatasetMapSearchEntry,
  );
  const peopleGroupSearchEntries = countries.flatMap((country) =>
    country.peopleGroups.map(
      (peopleGroup) =>
        ({
          id: `people-group:${peopleGroup.rowId}`,
          type: "people-group",
          label: peopleGroup.name,
          countryIso3: country.iso3,
          countryName: country.name,
          rowId: peopleGroup.rowId,
          searchText: normalizeDatasetMapSearchText(
            `${peopleGroup.name} ${country.name} ${country.sourceCountryNames.join(" ")}`,
          ),
        }) satisfies DatasetMapSearchEntry,
    ),
  );

  return {
    countries,
    countryByIso3,
    searchEntries: [...countrySearchEntries, ...peopleGroupSearchEntries],
    mappedRecordCount,
    unmappedRecordCount: rows.length - mappedRecordCount,
    unmappedReasonCounts,
    metricLabel: DATASET_MAP_METRIC_LABEL,
  };
}

export function searchDatasetMapEntries(
  aggregation: DatasetMapAggregation,
  query: string,
  limit = DEFAULT_DATASET_MAP_SEARCH_LIMIT,
) {
  const normalizedQuery = normalizeDatasetMapSearchText(query);

  if (!normalizedQuery) {
    return [] as DatasetMapSearchEntry[];
  }

  const normalizedLimit = Math.min(50, Math.max(1, Math.round(limit)));

  return aggregation.searchEntries
    .filter((entry) => entry.searchText.includes(normalizedQuery))
    .sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === "country" ? -1 : 1;
      }

      return left.label.localeCompare(right.label);
    })
    .slice(0, normalizedLimit);
}

export function isDatasetMapBoundaryCollection(
  value: unknown,
): value is DatasetMapBoundaryCollection {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { type?: unknown; features?: unknown };
  if (candidate.type !== "FeatureCollection" || !Array.isArray(candidate.features)) {
    return false;
  }

  return candidate.features.every((feature) => {
    if (!feature || typeof feature !== "object") {
      return false;
    }

    const typedFeature = feature as {
      type?: unknown;
      geometry?: unknown;
      properties?: { iso3?: unknown; name?: unknown } | null;
    };

    return (
      typedFeature.type === "Feature" &&
      Boolean(typedFeature.geometry) &&
      typeof typedFeature.properties?.iso3 === "string" &&
      typeof typedFeature.properties.name === "string"
    );
  });
}
