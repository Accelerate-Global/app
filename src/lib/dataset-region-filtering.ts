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

export function datasetSupportsRegionFiltering(
  dataset: Pick<DatasetSummary, "columns">,
) {
  return dataset.columns.some((column) => column.key === REGION_DATASET_COLUMN_KEY);
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
    const countryName = normalizeCountryName(
      row.data[REGION_DATASET_COLUMN_KEY],
    );

    if (!countryName) {
      return false;
    }

    return allowedCountryNames.has(countryName);
  });
}
