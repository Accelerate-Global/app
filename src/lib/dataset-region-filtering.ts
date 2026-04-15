import type { DatasetRowsResponse, DatasetSummary, FilterRegion } from "@/lib/api-types";
import {
  REGION_DATASET_COLUMN_KEY,
  UUPG_DATASET_COLUMN_KEY,
} from "@/lib/dataset-region-constants";

type DatasetRow = DatasetRowsResponse["rows"][number];

export type DatasetRegionFilterState = {
  enabled: boolean;
  isSupported: boolean;
  hasConfiguredRegions: boolean;
  enabledCountryNames: string[];
};

export type DatasetUupgFilterState = {
  enabled: boolean;
  isSupported: boolean;
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

function isDatasetColumnKey(
  value: string | null | undefined,
  expectedKey: string,
) {
  return normalizeDatasetColumnKey(value) === expectedKey;
}

function getDatasetValue(row: DatasetRow, expectedKey: string) {
  for (const [key, value] of Object.entries(row.data)) {
    if (isDatasetColumnKey(key, expectedKey)) {
      return value;
    }
  }

  return "";
}

function getRegionDatasetValue(row: DatasetRow) {
  return getDatasetValue(row, REGION_DATASET_COLUMN_KEY);
}

function getUupgDatasetValue(row: DatasetRow) {
  return getDatasetValue(row, UUPG_DATASET_COLUMN_KEY);
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

export function datasetSupportsUupgFiltering(
  dataset: Pick<DatasetSummary, "columns">,
) {
  return datasetSupportsColumnFiltering(dataset, UUPG_DATASET_COLUMN_KEY);
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
