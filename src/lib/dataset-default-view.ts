import type {
  DatasetRowsResponse,
  DatasetSummary,
  FilterRegion,
  SavedDatasetFilterState,
  SavedDatasetSort,
} from "@/lib/api-types";
import { applyDatasetFilterSections } from "@/lib/dataset-filtering";
import { sortDatasetRows } from "@/lib/dataset-table-columns";
import {
  buildDatasetOpenPreset,
  getDatasetFilterSectionsFromSavedView,
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
    applyDatasetFilterSections(
      input.rows,
      getDatasetFilterSectionsFromSavedView(input.dataset, filters),
    ).rows,
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
