import type {
  DatasetSummary,
  FilterRegion,
  SavedDatasetFilterState,
  SavedDatasetSort,
} from "@/lib/api-types";
import {
  datasetSupportsRegionFiltering,
  datasetSupportsUupgFiltering,
  datasetSupportsWatchlistFiltering,
  getEnabledRegionCountryNames,
  type DatasetRegionFilterState,
  type DatasetUupgFilterState,
  type DatasetWatchlistFilterState,
} from "@/lib/dataset-region-filtering";

function dedupeStrings(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

export function buildSavedDatasetFilterState(input: {
  regions: FilterRegion[];
  selectedRegionIds: Record<string, boolean>;
  regionEnabled: boolean;
  watchlistEnabled: boolean;
  watchlistThreshold: number;
  watchlistFrontierGroupValue: boolean;
  uupgEnabled: boolean;
  sorting: SavedDatasetSort[];
}): SavedDatasetFilterState {
  const selectedRegions = input.regions.filter(
    (region) => input.selectedRegionIds[region.id],
  );

  return {
    region: {
      enabled: input.regionEnabled,
      selectedRegionIds: selectedRegions.map((region) => region.id),
      selectedRegionNames: selectedRegions.map((region) => region.name),
      enabledCountryNames: getEnabledRegionCountryNames(
        input.regions,
        input.selectedRegionIds,
      ),
    },
    watchlist: {
      enabled: input.watchlistEnabled,
      threshold: input.watchlistThreshold,
      frontierGroupValue: input.watchlistFrontierGroupValue,
    },
    uupg: {
      enabled: input.uupgEnabled,
    },
    sorting: input.sorting.map((sort) => ({
      id: sort.id,
      desc: sort.desc,
    })),
  };
}

export function getDatasetRegionFilterStateFromSavedView(
  dataset: Pick<DatasetSummary, "columns">,
  filters: SavedDatasetFilterState,
): DatasetRegionFilterState {
  return {
    enabled: filters.region.enabled,
    isSupported: datasetSupportsRegionFiltering(dataset),
    hasConfiguredRegions: filters.region.enabledCountryNames.length > 0,
    enabledCountryNames: dedupeStrings(filters.region.enabledCountryNames),
  };
}

export function getDatasetWatchlistFilterStateFromSavedView(
  dataset: Pick<DatasetSummary, "columns">,
  filters: SavedDatasetFilterState,
): DatasetWatchlistFilterState {
  return {
    enabled: filters.watchlist.enabled,
    isSupported: datasetSupportsWatchlistFiltering(dataset),
    threshold: filters.watchlist.threshold,
    frontierGroupValue: filters.watchlist.frontierGroupValue,
  };
}

export function getDatasetUupgFilterStateFromSavedView(
  dataset: Pick<DatasetSummary, "columns">,
  filters: SavedDatasetFilterState,
): DatasetUupgFilterState {
  return {
    enabled: filters.uupg.enabled,
    isSupported: datasetSupportsUupgFiltering(dataset),
  };
}
