import { getCurrentIdentity } from "@/lib/auth";
import {
  filterDatasetRowsByRegion,
  filterDatasetRowsByUupg,
  filterDatasetRowsByWatchlist,
} from "@/lib/dataset-region-filtering";
import {
  getSavedDatasetDownloadFileName,
  serializeDatasetRowsToCsv,
} from "@/lib/dataset-download";
import {
  getSortedVisibleDatasetColumns,
  sortDatasetRows,
} from "@/lib/dataset-table-columns";
import { listFieldDefinitionPresentationByColumnKey } from "@/lib/field-definitions";
import { jsonError } from "@/lib/http";
import {
  getDatasetRegionFilterStateFromSavedView,
  getDatasetUupgFilterStateFromSavedView,
  getDatasetWatchlistFilterStateFromSavedView,
} from "@/lib/saved-dataset-filters";
import { getSavedDatasetTable } from "@/lib/saved-dataset-tables";
import { getAllDatasetRows, getDataset } from "@/lib/datasets";

type SavedTableDownloadContext = {
  params: Promise<{
    savedTableId: string;
  }>;
};

export async function GET(
  _request: Request,
  context: SavedTableDownloadContext,
) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  const { savedTableId } = await context.params;
  const savedTable = await getSavedDatasetTable({
    ownerId: identity.ownerId,
    savedTableId,
  });

  if (!savedTable) {
    return jsonError("Saved table not found.", 404);
  }

  const dataset = await getDataset(savedTable.datasetId);

  if (!dataset) {
    return jsonError("Dataset not found.", 404);
  }

  const [rowsResponse, fieldDefinitionPresentationByColumnKey] =
    await Promise.all([
      getAllDatasetRows({ datasetId: savedTable.datasetId }),
      listFieldDefinitionPresentationByColumnKey(dataset.columns),
    ]);

  if (!rowsResponse) {
    return jsonError("Dataset not found.", 404);
  }

  const visibleColumns = getSortedVisibleDatasetColumns({
    columns: dataset.columns,
    hiddenColumnKeys: dataset.hiddenColumnKeys,
    fieldDefinitionPresentationByColumnKey,
  });
  const filteredRows = filterDatasetRowsByUupg(
    filterDatasetRowsByWatchlist(
      filterDatasetRowsByRegion(
        rowsResponse.rows,
        getDatasetRegionFilterStateFromSavedView(dataset, savedTable.filters),
      ),
      getDatasetWatchlistFilterStateFromSavedView(dataset, savedTable.filters),
    ),
    getDatasetUupgFilterStateFromSavedView(dataset, savedTable.filters),
  );
  const sortedRows = sortDatasetRows(filteredRows, savedTable.filters.sorting);
  const csv = serializeDatasetRowsToCsv({
    rows: sortedRows,
    visibleColumns,
    fieldDefinitionPresentationByColumnKey,
  });

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${getSavedDatasetDownloadFileName(savedTable.name)}"`,
    },
  });
}
