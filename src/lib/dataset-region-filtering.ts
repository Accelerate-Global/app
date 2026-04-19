import type { DatasetRowsResponse, DatasetSummary, FilterRegion } from "@/lib/api-types";
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
  evangelicalBelieversEnabled?: boolean;
  evangelicalBelieversThreshold: number;
  evangelicalPercentEnabled?: boolean;
  evangelicalPercentThreshold: number;
  frontierGroupEnabled?: boolean;
  frontierGroupValue: boolean;
};

function normalizeCountryName(value: string | null | undefined) {
  return value?.trim() ?? "";
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
  const countryNames = new Set<string>();
  const hasSelectedRegion = regions.some((region) => selectedRegionIds[region.id]);

  for (const region of regions) {
    if (hasSelectedRegion && !selectedRegionIds[region.id]) {
      continue;
    }

    for (const country of region.countries) {
      const normalizedCountry = normalizeCountryName(country);

      if (normalizedCountry) {
        countryNames.add(normalizedCountry);
      }
    }
  }

  return Array.from(countryNames);
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

export function getAvailableDatasetCountryNames(rows: DatasetRow[]) {
  return dedupeCountryNames(
    rows.flatMap((row) => [
      normalizeCountryName(getRegionDatasetValue(row)),
      ...parseAlternateCountryNames(getAlternateCountryDatasetValue(row)),
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
  const evangelicalBelieversEnabled =
    watchlistFilter.evangelicalBelieversEnabled ?? true;
  const evangelicalPercentEnabled =
    watchlistFilter.evangelicalPercentEnabled ?? true;
  const frontierGroupEnabled = watchlistFilter.frontierGroupEnabled ?? true;
  const hasEnabledCriteria =
    thresholdEnabled ||
    engagementPhaseEnabled ||
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
        percentEvangelical < watchlistFilter.evangelicalPercentThreshold
      ) {
        return false;
      }

      if (evangelicalBelieversEnabled) {
        const population = normalizeDatasetNumericValue(
          getWatchlistPopulationDatasetValue(row),
        );

        if (population === null) {
          return false;
        }

        const evangelicalBelievers = population * (percentEvangelical / 100);

        if (
          evangelicalBelievers > watchlistFilter.evangelicalBelieversThreshold
        ) {
          return false;
        }
      }
    }

    return true;
  });
}
