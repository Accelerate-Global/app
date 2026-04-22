import { getCurrentIdentity } from "@/lib/auth";
import {
  getFilteredDatasetDownloadFileName,
  serializeDatasetRowsToCsv,
} from "@/lib/dataset-download";
import {
  applyDatasetDefaultFilters,
  getDatasetDefaultFilters,
} from "@/lib/dataset-default-view";
import { getSortedVisibleDatasetColumns } from "@/lib/dataset-table-columns";
import { listFieldDefinitionPresentationByColumnKey } from "@/lib/field-definitions";
import { jsonError } from "@/lib/http";
import { logError } from "@/lib/error-logging";
import { getAllDatasetRows, getDataset } from "@/lib/datasets";
import { getDatasetStorageBucket } from "@/lib/dataset-storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listFilterRegions } from "@/lib/filter-settings";

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
  const dataset = await getDataset(datasetId, {
    includeDisabled: identity.isDatasetAdmin,
  });

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

  const defaultFilters = getDatasetDefaultFilters(dataset);
  const [rowsResponse, fieldDefinitionPresentationByColumnKey, regions] =
    await Promise.all([
      getAllDatasetRows({
        datasetId: dataset.id,
        includeDisabled: identity.isDatasetAdmin,
      }),
      listFieldDefinitionPresentationByColumnKey(dataset.columns),
      listFilterRegions(),
    ]);

  if (!rowsResponse) {
    return jsonError("Dataset not found.", 404);
  }

  const visibleColumns = getSortedVisibleDatasetColumns({
    columns: dataset.columns,
    hiddenColumnKeys: dataset.hiddenColumnKeys,
    fieldDefinitionPresentationByColumnKey,
  });
  const filteredRows = defaultFilters
    ? applyDatasetDefaultFilters({
        dataset,
        rows: rowsResponse.rows,
        regions,
      })
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
