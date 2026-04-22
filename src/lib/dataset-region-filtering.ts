import type {
  DatasetHotspotsMetric,
  DatasetRowsResponse,
  DatasetSummary,
  FilterRegion,
} from "@/lib/api-types";
import type { PopulationBelieversRule } from "@/lib/api-types";
import {
  calculateActualBelievers,
  createSingleTierPopulationBelieversRule,
  getRequiredBelieversForPopulation,
  sanitizePopulationBelieversRule,
} from "@/lib/evangelical-population-believers-rule";
import { getFieldDefinitionCanonicalKeyLookupKeys } from "@/lib/field-definition-canonical";
import {
  HOTSPOTS_UNIQUE_GROUP_DATASET_COLUMN_KEY,
  COUNTRY_ALTERNATE_DATASET_COLUMN_KEY,
  REGION_DATASET_COLUMN_KEY,
  WATCHLIST_ENGAGEMENT_PHASES_DATASET_COLUMN_KEY,
  WATCHLIST_FRONTIER_GROUP_DATASET_COLUMN_KEY,
  WATCHLIST_PERCENT_EVANGELICAL_DATASET_COLUMN_KEY,
  WATCHLIST_POPULATION_DATASET_COLUMN_KEY,
  WATCHLIST_DATASET_COLUMN_KEY,
  UUPG_DATASET_COLUMN_KEY,
} from "@/lib/dataset-region-constants";
import { isGlobalRegionName } from "@/lib/region-display";

type DatasetRow = DatasetRowsResponse["rows"][number];
const WATCHLIST_FRONTIER_GROUP_DATASET_COLUMN_KEYS =
  getFieldDefinitionCanonicalKeyLookupKeys(
    WATCHLIST_FRONTIER_GROUP_DATASET_COLUMN_KEY,
  );
const WATCHLIST_FRONTIER_GROUP_DATASET_COLUMN_KEY_SET = new Set(
  WATCHLIST_FRONTIER_GROUP_DATASET_COLUMN_KEYS.map((key) =>
    normalizeDatasetColumnKey(key),
  ),
);
const datasetRowFilterFacetsCache = new WeakMap<
  DatasetRow,
  DatasetRowFilterFacets
>();

type DatasetRowFilterFacets = {
  primaryCountryName: string;
  primaryCountryKey: string;
  alternateCountryNames: string[];
  alternateCountryKeys: string[];
  uupgValue: string;
  uniqueGroupId: string;
  hasWatchlistValue: boolean;
  watchlistValue: number | null;
  watchlistFrontierGroupValue: string;
  watchlistPopulation: number | null;
  watchlistPercentEvangelical: number | null;
  watchlistEngagementPhase: number | null;
};

export type DatasetRegionFilterState = {
  enabled: boolean;
  isSupported: boolean;
  hasConfiguredRegions: boolean;
  enabledCountryNames: string[];
};

export type DatasetCountryFilterState = {
  enabled: boolean;
  isSupported: boolean;
  selectedCountryNames: string[];
  includeAlternateCountries: boolean;
};

export type DatasetUupgFilterState = {
  enabled: boolean;
  isSupported: boolean;
};

export type DatasetHotspotsFilterState = {
  enabled: boolean;
  isSupported: boolean;
  metric: DatasetHotspotsMetric;
  countryCount: number;
};

export type DatasetWatchlistFilterState = {
  enabled: boolean;
  isSupported: boolean;
  thresholdEnabled?: boolean;
  threshold: number;
  engagementPhaseEnabled?: boolean;
  engagementPhaseThreshold: number;
  evangelicalPopulationBelieversRuleEnabled?: boolean;
  evangelicalPopulationBelieversRule?: PopulationBelieversRule;
  evangelicalBelieversEnabled?: boolean;
  evangelicalBelieversThreshold?: number;
  evangelicalPercentEnabled?: boolean;
  evangelicalPercentThreshold?: number;
  frontierGroupEnabled?: boolean;
  frontierGroupValue?: boolean;
};

export type EffectiveCountrySelection = {
  selectedCountryNames: string[];
  hasExplicitSelection: boolean;
};

function normalizeCountryName(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function normalizeCountryKey(value: string) {
  return normalizeCountryName(value).toLowerCase();
}

function normalizeDatasetColumnKey(value: string | null | undefined) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "") ?? "";
}

function normalizeDatasetCellValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeDatasetNumericValue(value: string | null | undefined) {
  const trimmedValue = value?.trim() ?? "";

  if (!trimmedValue) {
    return null;
  }

  const parsedValue = Number(trimmedValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

export const DEFAULT_HOTSPOTS_METRIC = "unique_uupgs" as const;
export const DEFAULT_HOTSPOTS_COUNTRY_COUNT = 10;
export const MAX_HOTSPOTS_COUNTRY_COUNT = 500;

export function normalizeHotspotsMetric(
  value: DatasetHotspotsMetric | string | null | undefined,
): DatasetHotspotsMetric {
  return value === "population" ? "population" : DEFAULT_HOTSPOTS_METRIC;
}

export function normalizeHotspotsCountryCount(value: number | null | undefined) {
  const normalizedValue = Number.isFinite(value)
    ? Math.round(value as number)
    : DEFAULT_HOTSPOTS_COUNTRY_COUNT;

  return Math.min(
    MAX_HOTSPOTS_COUNTRY_COUNT,
    Math.max(1, normalizedValue),
  );
}

function isDatasetColumnKey(
  value: string | null | undefined,
  expectedKey: string,
) {
  return normalizeDatasetColumnKey(value) === expectedKey;
}

function getDatasetRowFilterFacets(row: DatasetRow) {
  const cachedFacets = datasetRowFilterFacetsCache.get(row);

  if (cachedFacets) {
    return cachedFacets;
  }

  let primaryCountryName = "";
  let primaryCountryKey = "";
  let alternateCountryNames: string[] = [];
  let alternateCountryKeys: string[] = [];
  let uupgValue = "";
  let uniqueGroupId = "";
  let hasWatchlistValue = false;
  let watchlistValue: number | null = null;
  let watchlistFrontierGroupValue = "";
  let watchlistPopulation: number | null = null;
  let watchlistPercentEvangelical: number | null = null;
  let watchlistEngagementPhase: number | null = null;

  // Scan row.data once and cache the normalized filter fields for future passes.
  for (const [key, value] of Object.entries(row.data)) {
    const normalizedKey = normalizeDatasetColumnKey(key);

    if (!primaryCountryName && normalizedKey === REGION_DATASET_COLUMN_KEY) {
      primaryCountryName = normalizeCountryName(value);
      primaryCountryKey = normalizeCountryKey(primaryCountryName);
      continue;
    }

    if (
      alternateCountryNames.length === 0 &&
      normalizedKey === COUNTRY_ALTERNATE_DATASET_COLUMN_KEY
    ) {
      alternateCountryNames = parseAlternateCountryNames(value);
      alternateCountryKeys = alternateCountryNames.map((countryName) =>
        normalizeCountryKey(countryName),
      );
      continue;
    }

    if (!uupgValue && normalizedKey === UUPG_DATASET_COLUMN_KEY) {
      uupgValue = normalizeDatasetCellValue(value);
      continue;
    }

    if (!uniqueGroupId && normalizedKey === HOTSPOTS_UNIQUE_GROUP_DATASET_COLUMN_KEY) {
      uniqueGroupId = (value ?? "").trim();
      continue;
    }

    if (watchlistValue === null && normalizedKey === WATCHLIST_DATASET_COLUMN_KEY) {
      hasWatchlistValue = (value?.trim() ?? "").length > 0;
      watchlistValue = normalizeDatasetNumericValue(value);
      continue;
    }

    if (
      !watchlistFrontierGroupValue &&
      WATCHLIST_FRONTIER_GROUP_DATASET_COLUMN_KEY_SET.has(normalizedKey)
    ) {
      watchlistFrontierGroupValue = normalizeDatasetCellValue(value);
      continue;
    }

    if (
      watchlistPopulation === null &&
      normalizedKey === WATCHLIST_POPULATION_DATASET_COLUMN_KEY
    ) {
      watchlistPopulation = normalizeDatasetNumericValue(value);
      continue;
    }

    if (
      watchlistPercentEvangelical === null &&
      normalizedKey === WATCHLIST_PERCENT_EVANGELICAL_DATASET_COLUMN_KEY
    ) {
      watchlistPercentEvangelical = normalizeDatasetNumericValue(value);
      continue;
    }

    if (
      watchlistEngagementPhase === null &&
      normalizedKey === WATCHLIST_ENGAGEMENT_PHASES_DATASET_COLUMN_KEY
    ) {
      watchlistEngagementPhase = normalizeDatasetNumericValue(value);
    }
  }

  const facets = {
    primaryCountryName,
    primaryCountryKey,
    alternateCountryNames,
    alternateCountryKeys,
    uupgValue,
    uniqueGroupId,
    hasWatchlistValue,
    watchlistValue,
    watchlistFrontierGroupValue,
    watchlistPopulation,
    watchlistPercentEvangelical,
    watchlistEngagementPhase,
  } satisfies DatasetRowFilterFacets;
  datasetRowFilterFacetsCache.set(row, facets);

  return facets;
}

function datasetSupportsColumnFiltering(
  dataset: Pick<DatasetSummary, "columns">,
  expectedKey: string,
) {
  return dataset.columns.some(
    (column) =>
      isDatasetColumnKey(column.key, expectedKey) ||
      isDatasetColumnKey(column.label, expectedKey),
  );
}

export function datasetSupportsRegionFiltering(
  dataset: Pick<DatasetSummary, "columns">,
) {
  return datasetSupportsColumnFiltering(dataset, REGION_DATASET_COLUMN_KEY);
}

export function datasetSupportsCountryFiltering(
  dataset: Pick<DatasetSummary, "columns">,
) {
  return datasetSupportsColumnFiltering(dataset, REGION_DATASET_COLUMN_KEY);
}

export function datasetSupportsAlternateCountryFiltering(
  dataset: Pick<DatasetSummary, "columns">,
) {
  return datasetSupportsColumnFiltering(
    dataset,
    COUNTRY_ALTERNATE_DATASET_COLUMN_KEY,
  );
}

export function datasetSupportsUupgFiltering(
  dataset: Pick<DatasetSummary, "columns">,
) {
  return datasetSupportsColumnFiltering(dataset, UUPG_DATASET_COLUMN_KEY);
}

export function datasetSupportsHotspotsFiltering(
  dataset: Pick<DatasetSummary, "columns">,
) {
  return [
    REGION_DATASET_COLUMN_KEY,
    UUPG_DATASET_COLUMN_KEY,
    WATCHLIST_POPULATION_DATASET_COLUMN_KEY,
    HOTSPOTS_UNIQUE_GROUP_DATASET_COLUMN_KEY,
  ].every((expectedKey) =>
    datasetSupportsColumnFiltering(dataset, expectedKey),
  );
}

export function datasetSupportsWatchlistFiltering(
  dataset: Pick<DatasetSummary, "columns">,
) {
  return [
    WATCHLIST_DATASET_COLUMN_KEY,
    WATCHLIST_POPULATION_DATASET_COLUMN_KEY,
    WATCHLIST_PERCENT_EVANGELICAL_DATASET_COLUMN_KEY,
    WATCHLIST_ENGAGEMENT_PHASES_DATASET_COLUMN_KEY,
  ].every((expectedKey) =>
    datasetSupportsColumnFiltering(dataset, expectedKey),
  );
}

export function getEnabledRegionCountryNames(
  regions: FilterRegion[],
  selectedRegionIds: Record<string, boolean>,
) {
  const selectedCountryNames = getSelectedRegionCountryNames(
    regions,
    selectedRegionIds,
  );

  if (selectedCountryNames.length > 0) {
    return selectedCountryNames;
  }

  const countryNames = new Set<string>();

  for (const region of regions) {
    for (const country of region.countries) {
      const normalizedCountry = normalizeCountryName(country);

      if (normalizedCountry) {
        countryNames.add(normalizedCountry);
      }
    }
  }

  return Array.from(countryNames);
}

export function getSelectedRegionCountryNames(
  regions: FilterRegion[],
  selectedRegionIds: Record<string, boolean>,
) {
  const countryNames = new Set<string>();

  for (const region of regions) {
    if (!selectedRegionIds[region.id]) {
      continue;
    }

    for (const country of region.countries) {
      const normalizedCountry = normalizeCountryName(country);

      if (normalizedCountry) {
        countryNames.add(normalizedCountry);
      }
    }
  }

  return Array.from(countryNames).sort((left, right) =>
    left.localeCompare(right),
  );
}

function parseAlternateCountryNames(value: string | null | undefined) {
  return value
    ?.split(";")
    .map((countryName) => normalizeCountryName(countryName))
    .filter(Boolean) ?? [];
}

function dedupeCountryNames(values: string[]) {
  const displayNameByNormalizedKey = new Map<string, string>();

  for (const value of values) {
    const displayName = normalizeCountryName(value);

    if (!displayName) {
      continue;
    }

    const normalizedKey = displayName.toLowerCase();

    if (!displayNameByNormalizedKey.has(normalizedKey)) {
      displayNameByNormalizedKey.set(normalizedKey, displayName);
    }
  }

  return Array.from(displayNameByNormalizedKey.values()).sort((left, right) =>
    left.localeCompare(right),
  );
}

function createCountryKeySet(values: string[]) {
  return new Set(
    dedupeCountryNames(values)
      .map((value) => normalizeCountryKey(value))
      .filter(Boolean),
  );
}

function areCountryKeySetsEqual(left: Set<string>, right: Set<string>) {
  if (left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }

  return true;
}

function isCountryKeySubset(subset: Set<string>, superset: Set<string>) {
  for (const value of subset) {
    if (!superset.has(value)) {
      return false;
    }
  }

  return true;
}

function intersectCountryKeySets(left: Set<string>, right: Set<string>) {
  const intersection = new Set<string>();

  for (const value of left) {
    if (right.has(value)) {
      intersection.add(value);
    }
  }

  return intersection;
}

type NormalizedRegionCountrySet = {
  id: string;
  name: string;
  sortOrder: number;
  isGlobal: boolean;
  countryKeys: Set<string>;
};

function getNormalizedRegionCountrySets(
  regions: FilterRegion[],
  comparisonCountryKeys?: Set<string>,
) {
  return regions.map((region) => ({
    id: region.id,
    name: region.name,
    sortOrder: region.sortOrder,
    isGlobal: isGlobalRegionName(region.name),
    countryKeys: comparisonCountryKeys
      ? intersectCountryKeySets(
          createCountryKeySet(region.countries),
          comparisonCountryKeys,
        )
      : createCountryKeySet(region.countries),
  }));
}

function compareRegionCombination(
  left: NormalizedRegionCountrySet[],
  right: NormalizedRegionCountrySet[],
) {
  if (left.length !== right.length) {
    return left.length - right.length;
  }

  const leftSortOrders = left.map((region) => region.sortOrder);
  const rightSortOrders = right.map((region) => region.sortOrder);
  const maxLength = Math.max(leftSortOrders.length, rightSortOrders.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftSortOrder = leftSortOrders[index] ?? 0;
    const rightSortOrder = rightSortOrders[index] ?? 0;

    if (leftSortOrder !== rightSortOrder) {
      return leftSortOrder - rightSortOrder;
    }
  }

  const leftIds = left.map((region) => region.id);
  const rightIds = right.map((region) => region.id);

  for (let index = 0; index < Math.max(leftIds.length, rightIds.length); index += 1) {
    const leftId = leftIds[index] ?? "";
    const rightId = rightIds[index] ?? "";

    if (leftId !== rightId) {
      return leftId.localeCompare(rightId);
    }
  }

  return 0;
}

function findExactRegionCountryCombination(
  candidates: NormalizedRegionCountrySet[],
  targetCountryKeys: Set<string>,
) {
  const exactMatches: NormalizedRegionCountrySet[][] = [];

  function search(
    startIndex: number,
    selectedRegions: NormalizedRegionCountrySet[],
    unionCountryKeys: Set<string>,
  ) {
    if (
      selectedRegions.length >= 2 &&
      areCountryKeySetsEqual(unionCountryKeys, targetCountryKeys)
    ) {
      exactMatches.push(selectedRegions);
      return;
    }

    for (let index = startIndex; index < candidates.length; index += 1) {
      const nextRegion = candidates[index];
      const nextUnionCountryKeys = new Set(unionCountryKeys);

      for (const countryKey of nextRegion.countryKeys) {
        nextUnionCountryKeys.add(countryKey);
      }

      if (nextUnionCountryKeys.size === unionCountryKeys.size) {
        continue;
      }

      search(index + 1, [...selectedRegions, nextRegion], nextUnionCountryKeys);
    }
  }

  search(0, [], new Set<string>());

  return exactMatches.sort(compareRegionCombination)[0] ?? null;
}

export function getMatchingRegionIdsForCountries(
  regions: FilterRegion[],
  selectedCountryNames: string[],
  comparisonCountryNames: string[],
) {
  const comparisonCountryKeys = createCountryKeySet(comparisonCountryNames);

  if (comparisonCountryKeys.size === 0) {
    return [] as string[];
  }

  const targetCountryKeys = intersectCountryKeySets(
    createCountryKeySet(selectedCountryNames),
    comparisonCountryKeys,
  );

  if (targetCountryKeys.size === 0) {
    return [] as string[];
  }

  const normalizedRegions = getNormalizedRegionCountrySets(
    regions,
    comparisonCountryKeys,
  ).filter((region) => region.countryKeys.size > 0);
  const globalRegion = normalizedRegions.find((region) => region.isGlobal) ?? null;

  if (
    globalRegion &&
    areCountryKeySetsEqual(globalRegion.countryKeys, targetCountryKeys)
  ) {
    return [globalRegion.id];
  }

  const candidateRegions = normalizedRegions
    .filter((region) => !region.isGlobal)
    .filter((region) => isCountryKeySubset(region.countryKeys, targetCountryKeys))
    .sort((left, right) => left.sortOrder - right.sortOrder);

  const exactSingleMatch =
    candidateRegions.find((region) =>
      areCountryKeySetsEqual(region.countryKeys, targetCountryKeys),
    ) ?? null;

  if (exactSingleMatch) {
    return [exactSingleMatch.id];
  }

  const exactCombination = findExactRegionCountryCombination(
    candidateRegions,
    targetCountryKeys,
  );

  if (!exactCombination) {
    return [] as string[];
  }

  return exactCombination.map((region) => region.id);
}

export function getEffectiveCountrySelection(input: {
  availableCountryNames: string[];
  countryFilterEnabled: boolean;
  regionFilterEnabled: boolean;
  regionCountryNames: string[];
  selectedCountryNames: string[];
}): EffectiveCountrySelection {
  const availableCountryNames = dedupeCountryNames(input.availableCountryNames);
  const availableCountryKeySet = new Set(
    availableCountryNames.map((countryName) => normalizeCountryKey(countryName)),
  );
  const baselineSelectedCountryNames = (
    input.regionFilterEnabled
      ? dedupeCountryNames(input.regionCountryNames)
      : availableCountryNames
  ).filter((countryName) =>
    availableCountryKeySet.has(normalizeCountryKey(countryName)),
  );
  const selectedCountryNames = dedupeCountryNames(
    input.selectedCountryNames,
  ).filter((countryName) =>
    availableCountryKeySet.has(normalizeCountryKey(countryName)),
  );
  const hasExplicitSelection =
    input.countryFilterEnabled &&
    selectedCountryNames.length > 0 &&
    !areCountryKeySetsEqual(
      createCountryKeySet(selectedCountryNames),
      createCountryKeySet(baselineSelectedCountryNames),
    );

  return {
    selectedCountryNames: hasExplicitSelection
      ? selectedCountryNames
      : baselineSelectedCountryNames,
    hasExplicitSelection,
  };
}

export function getAvailableDatasetCountryNames(
  rows: DatasetRow[],
  options?: {
    includeAlternateCountries?: boolean;
  },
) {
  return dedupeCountryNames(
    rows.flatMap((row) => {
      const facets = getDatasetRowFilterFacets(row);

      return [
        facets.primaryCountryName,
        ...(options?.includeAlternateCountries ? facets.alternateCountryNames : []),
      ];
    }),
  );
}

export function filterDatasetRowsByRegion(
  rows: DatasetRow[],
  regionFilter: DatasetRegionFilterState | null | undefined,
) {
  if (
    !regionFilter ||
    !regionFilter.enabled ||
    !regionFilter.isSupported ||
    !regionFilter.hasConfiguredRegions
  ) {
    return rows;
  }

  const allowedCountryNames = new Set(
    regionFilter.enabledCountryNames.map((countryName) =>
      normalizeCountryName(countryName),
    ),
  );

  return rows.filter((row) => {
    const countryName = getDatasetRowFilterFacets(row).primaryCountryName;

    if (!countryName) {
      return false;
    }

    return allowedCountryNames.has(countryName);
  });
}

export function filterDatasetRowsByCountry(
  rows: DatasetRow[],
  countryFilter: DatasetCountryFilterState | null | undefined,
) {
  if (
    !countryFilter ||
    !countryFilter.enabled ||
    !countryFilter.isSupported ||
    countryFilter.selectedCountryNames.length === 0
  ) {
    return rows;
  }

  const allowedCountryNames = new Set(
    countryFilter.selectedCountryNames
      .map((countryName) => normalizeCountryName(countryName).toLowerCase())
      .filter(Boolean),
  );

  return rows.filter((row) => {
    const facets = getDatasetRowFilterFacets(row);
    const primaryCountryName = facets.primaryCountryKey;

    if (primaryCountryName && allowedCountryNames.has(primaryCountryName)) {
      return true;
    }

    if (!countryFilter.includeAlternateCountries) {
      return false;
    }

    return facets.alternateCountryKeys.some(
      (countryName) => allowedCountryNames.has(countryName),
    );
  });
}

export function filterDatasetRowsByUupg(
  rows: DatasetRow[],
  uupgFilter: DatasetUupgFilterState | null | undefined,
) {
  if (!uupgFilter || !uupgFilter.enabled || !uupgFilter.isSupported) {
    return rows;
  }

  return rows.filter((row) => isUupgDatasetRow(getDatasetRowFilterFacets(row)));
}

function matchesExpectedBooleanOrBlank(
  value: string,
  expectedValue: "false" | "true",
) {
  return value.length === 0 || value === expectedValue;
}

function isUupgDatasetRow(
  row: Pick<DatasetRowFilterFacets, "uupgValue" | "watchlistFrontierGroupValue">,
) {
  return (
    matchesExpectedBooleanOrBlank(row.uupgValue, "false") &&
    matchesExpectedBooleanOrBlank(row.watchlistFrontierGroupValue, "true")
  );
}

export function filterDatasetRowsByHotspots(
  rows: DatasetRow[],
  hotspotsFilter: DatasetHotspotsFilterState | null | undefined,
) {
  if (
    !hotspotsFilter ||
    !hotspotsFilter.enabled ||
    !hotspotsFilter.isSupported
  ) {
    return rows;
  }

  const countryMetrics = new Map<
    string,
    {
      countryName: string;
      uniqueGroupIds: Set<string>;
      population: number;
    }
  >();

  for (const row of rows) {
    const facets = getDatasetRowFilterFacets(row);

    if (!facets.primaryCountryName || !isUupgDatasetRow(facets)) {
      continue;
    }

    const countryMetric = countryMetrics.get(facets.primaryCountryKey) ?? {
      countryName: facets.primaryCountryName,
      uniqueGroupIds: new Set<string>(),
      population: 0,
    };

    if (facets.uniqueGroupId) {
      countryMetric.uniqueGroupIds.add(facets.uniqueGroupId);
    }

    countryMetric.population += facets.watchlistPopulation ?? 0;
    countryMetrics.set(facets.primaryCountryKey, countryMetric);
  }

  const metric = normalizeHotspotsMetric(hotspotsFilter.metric);
  const countryCount = normalizeHotspotsCountryCount(hotspotsFilter.countryCount);
  const hotspotCountryKeys = new Set(
    Array.from(countryMetrics.entries())
      .sort((left, right) => {
        const leftMetric =
          metric === "population"
            ? left[1].population
            : left[1].uniqueGroupIds.size;
        const rightMetric =
          metric === "population"
            ? right[1].population
            : right[1].uniqueGroupIds.size;

        if (leftMetric !== rightMetric) {
          return rightMetric - leftMetric;
        }

        return left[1].countryName.localeCompare(right[1].countryName);
      })
      .slice(0, countryCount)
      .map(([countryKey]) => countryKey),
  );

  return rows.filter((row) => {
    const facets = getDatasetRowFilterFacets(row);

    return (
      facets.primaryCountryKey.length > 0 &&
      hotspotCountryKeys.has(facets.primaryCountryKey) &&
      isUupgDatasetRow(facets)
    );
  });
}

export function filterDatasetRowsByWatchlist(
  rows: DatasetRow[],
  watchlistFilter: DatasetWatchlistFilterState | null | undefined,
) {
  if (
    !watchlistFilter ||
    !watchlistFilter.enabled ||
    !watchlistFilter.isSupported
  ) {
    return rows;
  }

  const thresholdEnabled = watchlistFilter.thresholdEnabled ?? true;
  const engagementPhaseEnabled = watchlistFilter.engagementPhaseEnabled ?? true;
  const hasTieredPopulationBelieversRule = Boolean(
    watchlistFilter.evangelicalPopulationBelieversRule,
  );
  const populationBelieversRuleEnabled =
    watchlistFilter.evangelicalPopulationBelieversRuleEnabled ??
    hasTieredPopulationBelieversRule;
  const evangelicalBelieversEnabled =
    !hasTieredPopulationBelieversRule &&
    (watchlistFilter.evangelicalBelieversEnabled ?? true);
  const evangelicalPercentEnabled =
    !hasTieredPopulationBelieversRule &&
    (watchlistFilter.evangelicalPercentEnabled ?? true);
  const populationBelieversRule =
    populationBelieversRuleEnabled
      ? watchlistFilter.evangelicalPopulationBelieversRule
        ? sanitizePopulationBelieversRule(
            watchlistFilter.evangelicalPopulationBelieversRule,
          )
        : watchlistFilter.evangelicalBelieversThreshold !== undefined
          ? createSingleTierPopulationBelieversRule(
              watchlistFilter.evangelicalBelieversThreshold,
            )
          : null
      : null;
  const hasEnabledCriteria =
    thresholdEnabled ||
    engagementPhaseEnabled ||
    Boolean(populationBelieversRule) ||
    evangelicalBelieversEnabled ||
    evangelicalPercentEnabled;

  if (!hasEnabledCriteria) {
    return rows;
  }

  return rows.filter((row) => {
    const facets = getDatasetRowFilterFacets(row);

    if (thresholdEnabled) {
      const value = facets.watchlistValue;

      if (
        facets.hasWatchlistValue &&
        (value === null || value > watchlistFilter.threshold)
      ) {
        return false;
      }
    }

    if (engagementPhaseEnabled) {
      const engagementPhase = facets.watchlistEngagementPhase;

      if (
        engagementPhase === null ||
        engagementPhase < watchlistFilter.engagementPhaseThreshold
      ) {
        return false;
      }
    }

    if (
      Boolean(populationBelieversRule) ||
      evangelicalPercentEnabled ||
      evangelicalBelieversEnabled
    ) {
      const percentEvangelical = facets.watchlistPercentEvangelical;

      if (percentEvangelical === null) {
        return false;
      }

      if (
        evangelicalPercentEnabled &&
        percentEvangelical <
          (watchlistFilter.evangelicalPercentThreshold ?? 0)
      ) {
        return false;
      }

      if (populationBelieversRule || evangelicalBelieversEnabled) {
        const population = facets.watchlistPopulation;

        if (population === null) {
          return false;
        }

        const evangelicalBelievers = calculateActualBelievers(
          population,
          percentEvangelical,
        );

        if (evangelicalBelievers === null) {
          return false;
        }

        if (populationBelieversRule) {
          const requiredBelievers = getRequiredBelieversForPopulation(
            populationBelieversRule,
            population,
          )

          if (evangelicalBelievers < requiredBelievers) {
            return false;
          }
        } else if (
          evangelicalBelieversEnabled &&
          evangelicalBelievers <
            (watchlistFilter.evangelicalBelieversThreshold ?? 0)
        ) {
          return false;
        }
      }
    }

    return true;
  });
}
