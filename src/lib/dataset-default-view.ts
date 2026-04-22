import type {
  DatasetRowsResponse,
  DatasetSummary,
  FilterRegion,
  SavedDatasetFilterState,
  SavedDatasetSort,
} from "@/lib/api-types";
import {
  filterDatasetRowsByCountry,
  filterDatasetRowsByHotspots,
  filterDatasetRowsByRegion,
  filterDatasetRowsByUupg,
  filterDatasetRowsByWatchlist,
} from "@/lib/dataset-region-filtering";
import { sortDatasetRows } from "@/lib/dataset-table-columns";
import {
  buildDatasetOpenPreset,
  getDatasetCountryFilterStateFromSavedView,
  getDatasetHotspotsFilterStateFromSavedView,
  getDatasetRegionFilterStateFromSavedView,
  getDatasetUupgFilterStateFromSavedView,
  getDatasetWatchlistFilterStateFromSavedView,
  normalizeSavedDatasetFilterState,
} from "@/lib/saved-dataset-filters";

type DatasetRow = DatasetRowsResponse["rows"][number];
type DatasetDefaultViewDataset = Pick<
  DatasetSummary,
  "columns" | "defaultFilters"
>;

export function getDatasetDefaultFilters(
  dataset: DatasetDefaultViewDataset,
): SavedDatasetFilterState | null {
  return dataset.defaultFilters
    ? normalizeSavedDatasetFilterState(dataset.defaultFilters)
    : null;
}

export function getDatasetDefaultOpenPreset(
  dataset: DatasetDefaultViewDataset,
) {
  const filters = getDatasetDefaultFilters(dataset);

  return filters ? buildDatasetOpenPreset(filters) : null;
}

export function getDatasetDefaultSorting(
  dataset: DatasetDefaultViewDataset,
): SavedDatasetSort[] | null {
  if (!dataset.defaultFilters) {
    return null;
  }

  return normalizeSavedDatasetFilterState(dataset.defaultFilters).sorting;
}

export function applyDatasetDefaultFilters(input: {
  dataset: DatasetDefaultViewDataset;
  rows: DatasetRow[];
  regions: FilterRegion[];
}) {
  const filters = getDatasetDefaultFilters(input.dataset);

  if (!filters) {
    return sortDatasetRows(input.rows, []);
  }

  return sortDatasetRows(
    filterDatasetRowsByCountry(
      filterDatasetRowsByUupg(
        filterDatasetRowsByHotspots(
          filterDatasetRowsByWatchlist(
            filterDatasetRowsByRegion(
              input.rows,
              getDatasetRegionFilterStateFromSavedView(input.dataset, filters),
            ),
            getDatasetWatchlistFilterStateFromSavedView(input.dataset, filters),
          ),
          getDatasetHotspotsFilterStateFromSavedView(input.dataset, filters),
        ),
        getDatasetUupgFilterStateFromSavedView(input.dataset, filters),
      ),
      getDatasetCountryFilterStateFromSavedView(input.dataset, filters),
    ),
    filters.sorting,
  );
}

export function countDatasetDefaultRows(input: {
  dataset: DatasetDefaultViewDataset;
  rows: DatasetRow[];
  regions: FilterRegion[];
}) {
  return applyDatasetDefaultFilters(input).length;
}
