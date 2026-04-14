import type { DatasetRowsResponse, DatasetSummary, FilterRegion } from "@/lib/api-types";
import { REGION_DATASET_COLUMN_KEY } from "@/lib/dataset-region-constants";

type DatasetRow = DatasetRowsResponse["rows"][number];

export type DatasetRegionFilterState = {
  enabled: boolean;
  isSupported: boolean;
  hasConfiguredRegions: boolean;
  enabledCountryNames: string[];
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

function isRegionDatasetColumnKey(value: string | null | undefined) {
  return normalizeDatasetColumnKey(value) === REGION_DATASET_COLUMN_KEY;
}

function getRegionDatasetValue(row: DatasetRow) {
  for (const [key, value] of Object.entries(row.data)) {
    if (isRegionDatasetColumnKey(key)) {
      return value;
    }
  }

  return "";
}

export function datasetSupportsRegionFiltering(
  dataset: Pick<DatasetSummary, "columns">,
) {
  return dataset.columns.some(
    (column) =>
      isRegionDatasetColumnKey(column.key) ||
      isRegionDatasetColumnKey(column.label),
  );
}

export function getEnabledRegionCountryNames(
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

  if (regionFilter.enabledCountryNames.length === 0) {
    return [];
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
