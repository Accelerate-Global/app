import { getCurrentIdentity } from "@/lib/auth";
import {
  filterDatasetRowsByCountry,
  filterDatasetRowsByRegion,
  filterDatasetRowsByUupg,
  filterDatasetRowsByWatchlist,
} from "@/lib/dataset-region-filtering";
import {
  getFilteredDatasetDownloadFileName,
  serializeDatasetRowsToCsv,
} from "@/lib/dataset-download";
import { getDatasetOpenPresetTag } from "@/lib/dataset-tags";
import { getSortedVisibleDatasetColumns } from "@/lib/dataset-table-columns";
import { listFieldDefinitionPresentationByColumnKey } from "@/lib/field-definitions";
import { jsonError } from "@/lib/http";
import { logError } from "@/lib/error-logging";
import {
  getDatasetCountryFilterStateFromSavedView,
  getDatasetRegionFilterStateFromSavedView,
  getDatasetUupgFilterStateFromSavedView,
  getDatasetWatchlistFilterStateFromSavedView,
  getSavedDatasetFilterStateFromOpenPreset,
} from "@/lib/saved-dataset-filters";
import { getAllDatasetRows, getDataset } from "@/lib/datasets";
import { getDatasetStorageBucket } from "@/lib/dataset-storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type DatasetContext = {
  params: Promise<{
    datasetId: string;
  }>;
};

export async function GET(_request: Request, context: DatasetContext) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    return jsonError("Unauthorized.", 401);
  }

  const { datasetId } = await context.params;
  const dataset = await getDataset(datasetId);

  if (!dataset) {
    return jsonError("Dataset not found.", 404);
  }

  if (!dataset.backingDatasetId) {
    try {
      const supabase = createSupabaseAdminClient();
      const signedUrl = await supabase.storage
        .from(getDatasetStorageBucket())
        .createSignedUrl(dataset.blobPath, 60, {
          download: dataset.fileName,
        });

      if (signedUrl.error) {
        throw signedUrl.error;
      }

      return Response.redirect(signedUrl.data.signedUrl);
    } catch (error) {
      logError("Failed to create a signed dataset download URL", error);
      return jsonError("The dataset download could not be prepared.", 502);
    }
  }

  const presetFilters = getSavedDatasetFilterStateFromOpenPreset(
    getDatasetOpenPresetTag(dataset.tags)?.openPreset ?? null,
  );
  const [rowsResponse, fieldDefinitionPresentationByColumnKey] =
    await Promise.all([
      getAllDatasetRows({ datasetId: dataset.id }),
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
  const filteredRows = presetFilters
    ? filterDatasetRowsByUupg(
        filterDatasetRowsByWatchlist(
          filterDatasetRowsByCountry(
            filterDatasetRowsByRegion(
              rowsResponse.rows,
              getDatasetRegionFilterStateFromSavedView(dataset, presetFilters),
            ),
            getDatasetCountryFilterStateFromSavedView(dataset, presetFilters),
          ),
          getDatasetWatchlistFilterStateFromSavedView(dataset, presetFilters),
        ),
        getDatasetUupgFilterStateFromSavedView(dataset, presetFilters),
      )
    : rowsResponse.rows;
  const csv = serializeDatasetRowsToCsv({
    rows: filteredRows,
    visibleColumns,
    fieldDefinitionPresentationByColumnKey,
  });

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${getFilteredDatasetDownloadFileName(dataset.fileName)}"`,
    },
  });
}
