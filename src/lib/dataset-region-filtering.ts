import type { DatasetRowsResponse, DatasetSummary, FilterRegion } from "@/lib/api-types";
import type { PopulationBelieversRule } from "@/lib/api-types";
import {
  calculateActualBelievers,
  createSingleTierPopulationBelieversRule,
  getRequiredBelieversForPopulation,
  sanitizePopulationBelieversRule,
} from "@/lib/evangelical-population-believers-rule";
import { getFieldDefinitionCanonicalKeyLookupKeys } from "@/lib/field-definition-canonical";
import {
  COUNTRY_ALTERNATE_DATASET_COLUMN_KEY,
  REGION_DATASET_COLUMN_KEY,
  WATCHLIST_ENGAGEMENT_PHASES_DATASET_COLUMN_KEY,
  WATCHLIST_PERCENT_EVANGELICAL_DATASET_COLUMN_KEY,
  WATCHLIST_POPULATION_DATASET_COLUMN_KEY,
  WATCHLIST_FRONTIER_GROUP_DATASET_COLUMN_KEY,
  WATCHLIST_DATASET_COLUMN_KEY,
  UUPG_DATASET_COLUMN_KEY,
} from "@/lib/dataset-region-constants";
import { isGlobalRegionName } from "@/lib/region-display";

type DatasetRow = DatasetRowsResponse["rows"][number];
const WATCHLIST_FRONTIER_GROUP_DATASET_COLUMN_KEYS =
  getFieldDefinitionCanonicalKeyLookupKeys(
    WATCHLIST_FRONTIER_GROUP_DATASET_COLUMN_KEY,
  );

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
  frontierGroupValue: boolean;
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

function isDatasetColumnKey(
  value: string | null | undefined,
  expectedKey: string,
) {
  return normalizeDatasetColumnKey(value) === expectedKey;
}

function findDatasetValue(row: DatasetRow, expectedKey: string) {
  for (const [key, value] of Object.entries(row.data)) {
    if (isDatasetColumnKey(key, expectedKey)) {
      return value;
    }
  }

  return undefined;
}

function getDatasetValue(row: DatasetRow, expectedKey: string) {
  return findDatasetValue(row, expectedKey) ?? "";
}

function getDatasetValueByKeys(
  row: DatasetRow,
  expectedKeys: readonly string[],
) {
  for (const expectedKey of expectedKeys) {
    const value = findDatasetValue(row, expectedKey);

    if (value !== undefined) {
      return value;
    }
  }

  return "";
}

function getRegionDatasetValue(row: DatasetRow) {
  return getDatasetValue(row, REGION_DATASET_COLUMN_KEY);
}

function getAlternateCountryDatasetValue(row: DatasetRow) {
  return getDatasetValue(row, COUNTRY_ALTERNATE_DATASET_COLUMN_KEY);
}

function getUupgDatasetValue(row: DatasetRow) {
  return getDatasetValue(row, UUPG_DATASET_COLUMN_KEY);
}

function getWatchlistDatasetValue(row: DatasetRow) {
  return getDatasetValue(row, WATCHLIST_DATASET_COLUMN_KEY);
}

function getWatchlistFrontierGroupDatasetValue(row: DatasetRow) {
  return getDatasetValueByKeys(
    row,
    WATCHLIST_FRONTIER_GROUP_DATASET_COLUMN_KEYS,
  );
}

function getWatchlistPopulationDatasetValue(row: DatasetRow) {
  return getDatasetValue(row, WATCHLIST_POPULATION_DATASET_COLUMN_KEY);
}

function getWatchlistPercentEvangelicalDatasetValue(row: DatasetRow) {
  return getDatasetValue(row, WATCHLIST_PERCENT_EVANGELICAL_DATASET_COLUMN_KEY);
}

function getWatchlistEngagementPhasesDatasetValue(row: DatasetRow) {
  return getDatasetValue(row, WATCHLIST_ENGAGEMENT_PHASES_DATASET_COLUMN_KEY);
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

function datasetSupportsAnyColumnFiltering(
  dataset: Pick<DatasetSummary, "columns">,
  expectedKeys: readonly string[],
) {
  return expectedKeys.some((expectedKey) =>
    datasetSupportsColumnFiltering(dataset, expectedKey),
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
  ) && datasetSupportsAnyColumnFiltering(
    dataset,
    WATCHLIST_FRONTIER_GROUP_DATASET_COLUMN_KEYS,
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
    rows.flatMap((row) => [
      normalizeCountryName(getRegionDatasetValue(row)),
      ...(options?.includeAlternateCountries
        ? parseAlternateCountryNames(getAlternateCountryDatasetValue(row))
        : []),
    ]),
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
    const countryName = normalizeCountryName(getRegionDatasetValue(row));

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
    const primaryCountryName = normalizeCountryName(getRegionDatasetValue(row)).toLowerCase();

    if (primaryCountryName && allowedCountryNames.has(primaryCountryName)) {
      return true;
    }

    if (!countryFilter.includeAlternateCountries) {
      return false;
    }

    return parseAlternateCountryNames(getAlternateCountryDatasetValue(row)).some(
      (countryName) => allowedCountryNames.has(countryName.toLowerCase()),
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

  return rows.filter(
    (row) => normalizeDatasetCellValue(getUupgDatasetValue(row)) === "false",
  );
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
  const frontierGroupEnabled = watchlistFilter.frontierGroupEnabled ?? true;
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
    evangelicalPercentEnabled ||
    frontierGroupEnabled;

  if (!hasEnabledCriteria) {
    return rows;
  }

  return rows.filter((row) => {
    if (thresholdEnabled) {
      const value = normalizeDatasetNumericValue(getWatchlistDatasetValue(row));

      if (value === null || value > watchlistFilter.threshold) {
        return false;
      }
    }

    if (engagementPhaseEnabled) {
      const engagementPhase = normalizeDatasetNumericValue(
        getWatchlistEngagementPhasesDatasetValue(row),
      );

      if (
        engagementPhase === null ||
        engagementPhase < watchlistFilter.engagementPhaseThreshold
      ) {
        return false;
      }
    }

    if (frontierGroupEnabled) {
      const frontierGroupValue = normalizeDatasetCellValue(
        getWatchlistFrontierGroupDatasetValue(row),
      );
      const expectedFrontierGroupValue = watchlistFilter.frontierGroupValue
        ? "true"
        : "false";

      if (frontierGroupValue !== expectedFrontierGroupValue) {
        return false;
      }
    }

    if (
      Boolean(populationBelieversRule) ||
      evangelicalPercentEnabled ||
      evangelicalBelieversEnabled
    ) {
      const percentEvangelical = normalizeDatasetNumericValue(
        getWatchlistPercentEvangelicalDatasetValue(row),
      );

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
        const population = normalizeDatasetNumericValue(
          getWatchlistPopulationDatasetValue(row),
        );

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
