"use client";

import { Globe2Icon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  ensureDatasetRowsCache,
  getDatasetRowsCacheSnapshot,
  isDatasetRowsRequestCancelled,
} from "@/components/dashboard/dataset-row-cache";
import { DatasetsGrid } from "@/components/dashboard/datasets-grid";
import { SavedTableDetailSheet } from "@/components/dashboard/saved-table-detail-sheet";
import { SavedTablesGrid } from "@/components/dashboard/saved-tables-grid";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  buildAnalyticsContext,
  getEnabledFilterSections,
  type AnalyticsWorkspaceRole,
  withAnalyticsContext,
} from "@/lib/analytics";
import type { DatasetSummary, SavedDatasetTable } from "@/lib/api-types";
import { trackAppEvent } from "@/lib/analytics-client";

type DashboardClientProps = {
  initialDatasets: DatasetSummary[];
  initialSavedTables: SavedDatasetTable[];
  canManageDatasets: boolean;
  actorOwnerId?: string;
  workspaceRole?: AnalyticsWorkspaceRole;
};

type SavedDatasetTableResponse = {
  savedTable: SavedDatasetTable;
};

type DatasetsResponse = {
  datasets: DatasetSummary[];
};

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

async function reorderDatasetRecords(datasetIds: string[]) {
  const response = await fetch("/api/datasets/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ datasetIds }),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, "The dataset order could not be updated."),
    );
  }

  return ((await response.json()) as DatasetsResponse).datasets;
}
async function updateSavedTableRecord(input: {
  savedTableId: string;
  name: string;
  details: string;
}) {
  const response = await fetch(`/api/saved-tables/${input.savedTableId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      details: input.details,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, "The saved table could not be updated."),
    );
  }

  return ((await response.json()) as SavedDatasetTableResponse).savedTable;
}

async function deleteSavedTableRecord(savedTableId: string) {
  const response = await fetch(`/api/saved-tables/${savedTableId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, "The saved table could not be deleted."),
    );
  }

  return ((await response.json()) as SavedDatasetTableResponse).savedTable;
}

export function DashboardClient({
  initialDatasets,
  initialSavedTables,
  canManageDatasets,
  actorOwnerId = "anonymous",
  workspaceRole = "anonymous",
}: DashboardClientProps) {
  const [datasets, setDatasets] = useState(initialDatasets);
  const [savedTables, setSavedTables] = useState(initialSavedTables);
  const [activeSavedTableId, setActiveSavedTableId] = useState<string | null>(null);
  const [updatingSavedTableId, setUpdatingSavedTableId] = useState<string | null>(null);
  const [deletingSavedTableId, setDeletingSavedTableId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  const activeSavedTable =
    activeSavedTableId === null
      ? null
      : savedTables.find((savedTable) => savedTable.id === activeSavedTableId) ?? null;
  const activeSavedTableDataset =
    activeSavedTable === null
      ? null
      : datasets.find((dataset) => dataset.id === activeSavedTable.datasetId) ?? null;
  const analyticsContext = useMemo(
    () =>
      buildAnalyticsContext({
        route: "dashboard",
        actorOwnerId,
        workspaceRole,
      }),
    [actorOwnerId, workspaceRole],
  );
  const primaryDataset = useMemo(
    () => initialDatasets.find((dataset) => dataset.isPrimary) ?? null,
    [initialDatasets],
  );

  useEffect(() => {
    trackAppEvent(
      "dashboard_viewed",
      withAnalyticsContext(analyticsContext, {
        source_surface: "dashboard_page",
        success: true,
        dataset_count: initialDatasets.length,
        saved_table_count: initialSavedTables.length,
      }),
    );
  }, [analyticsContext, initialDatasets.length, initialSavedTables.length]);

  useEffect(() => {
    if (!primaryDataset || primaryDataset.status !== "ready") {
      return;
    }

    const sourceDatasetId = primaryDataset.backingDatasetId ?? primaryDataset.id;
    const preloadStartTime = Date.now();
    const { started, promise } = ensureDatasetRowsCache({
      datasetId: primaryDataset.id,
      sourceDatasetId,
      expectedRowCount: primaryDataset.rowCount,
    });

    if (!started) {
      return;
    }

    trackAppEvent(
      "dataset_preload_started",
      withAnalyticsContext(analyticsContext, {
        source_surface: "dashboard_page",
        success: true,
        dataset_id: primaryDataset.id,
        source_dataset_id: sourceDatasetId,
      }),
    );

    void promise
      ?.then(() => {
        const snapshot = getDatasetRowsCacheSnapshot(sourceDatasetId);
        trackAppEvent(
          "dataset_preload_completed",
          withAnalyticsContext(analyticsContext, {
            source_surface: "dashboard_page",
            success: true,
            dataset_id: primaryDataset.id,
            source_dataset_id: sourceDatasetId,
            row_count: snapshot.rows.length,
            load_duration_ms: Date.now() - preloadStartTime,
            duration_ms: Date.now() - preloadStartTime,
          }),
        );
      })
      .catch((error) => {
        if (isDatasetRowsRequestCancelled(error)) {
          return;
        }

        trackAppEvent(
          "dataset_preload_failed",
          withAnalyticsContext(analyticsContext, {
            source_surface: "dashboard_page",
            success: false,
            error_code: "dataset_preload_failed",
            dataset_id: primaryDataset.id,
            source_dataset_id: sourceDatasetId,
            duration_ms: Date.now() - preloadStartTime,
          }),
        );
      });
  }, [analyticsContext, primaryDataset]);

  async function handleReorderDatasets(nextDatasets: DatasetSummary[]) {
    if (!canManageDatasets || isReordering) {
      return;
    }

    const currentDatasetIds = datasets.map((dataset) => dataset.id);
    const nextDatasetIds = nextDatasets.map((dataset) => dataset.id);

    if (currentDatasetIds.join(",") === nextDatasetIds.join(",")) {
      return;
    }

    const previousDatasets = datasets;
    setDatasets(nextDatasets);
    setIsReordering(true);

    try {
      const reorderedDatasets = await reorderDatasetRecords(nextDatasetIds);
      setDatasets(reorderedDatasets);
      trackAppEvent(
        "dataset_reordered",
        withAnalyticsContext(analyticsContext, {
          source_surface: "datasets_grid",
          success: true,
          dataset_count: reorderedDatasets.length,
        }),
      );
    } catch (error) {
      setDatasets(previousDatasets);
      trackAppEvent(
        "dataset_reordered",
        withAnalyticsContext(analyticsContext, {
          source_surface: "datasets_grid",
          success: false,
          error_code: "reorder_failed",
          dataset_count: previousDatasets.length,
        }),
      );
      window.alert(
        error instanceof Error
          ? error.message
          : "The dataset order could not be updated.",
      );
    } finally {
      setIsReordering(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Globe2Icon className="size-5 text-muted-foreground" />
            Reference Resources
          </CardTitle>
          <CardDescription>
            Reusable lookup data for dataset review and cleanup work.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/dashboard/resources"
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            Browse reference resources
          </Link>
        </CardContent>
      </Card>
      <SavedTablesGrid
        savedTables={savedTables}
        onOpenDetails={setActiveSavedTableId}
      />
      <DatasetsGrid
        datasets={datasets}
        canManageDatasets={canManageDatasets}
        isBusy={isReordering}
        onReorderDatasets={handleReorderDatasets}
      />
      {activeSavedTable ? (
        <SavedTableDetailSheet
          key={`${activeSavedTable.id}:${activeSavedTable.updatedAt}`}
          savedTable={activeSavedTable}
          dataset={activeSavedTableDataset}
          isSaving={activeSavedTable.id === updatingSavedTableId}
          isDeleting={activeSavedTable.id === deletingSavedTableId}
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setActiveSavedTableId(null);
            }
          }}
          onSaveSavedTable={async (input) => {
            if (updatingSavedTableId !== null || deletingSavedTableId !== null) {
              return;
            }

            setUpdatingSavedTableId(input.savedTableId);
            const savedTableToUpdate =
              savedTables.find((savedTable) => savedTable.id === input.savedTableId) ??
              null;

            try {
              const updatedSavedTable = await updateSavedTableRecord(input);

              setSavedTables((current) =>
                current.map((savedTable) =>
                  savedTable.id === updatedSavedTable.id
                    ? updatedSavedTable
                    : savedTable,
                ),
              );
              trackAppEvent(
                "saved_table_updated",
                withAnalyticsContext(analyticsContext, {
                  source_surface: "saved_table_detail_sheet",
                  success: true,
                  dataset_id: updatedSavedTable.datasetId,
                  saved_table_id: updatedSavedTable.id,
                  saved_row_count: updatedSavedTable.savedRowCount,
                  filter_sections_enabled: getEnabledFilterSections(
                    updatedSavedTable.filters,
                  ),
                }),
              );
            } catch (error) {
              if (savedTableToUpdate) {
                trackAppEvent(
                  "saved_table_updated",
                  withAnalyticsContext(analyticsContext, {
                    source_surface: "saved_table_detail_sheet",
                    success: false,
                    error_code: "saved_table_update_failed",
                    dataset_id: savedTableToUpdate.datasetId,
                    saved_table_id: savedTableToUpdate.id,
                    saved_row_count: savedTableToUpdate.savedRowCount,
                    filter_sections_enabled: getEnabledFilterSections(
                      savedTableToUpdate.filters,
                    ),
                  }),
                );
              }
              throw error;
            } finally {
              setUpdatingSavedTableId(null);
            }
          }}
          onDeleteSavedTable={async (savedTableId) => {
            if (updatingSavedTableId !== null || deletingSavedTableId !== null) {
              return;
            }

            setDeletingSavedTableId(savedTableId);
            const savedTableToDelete =
              savedTables.find((savedTable) => savedTable.id === savedTableId) ?? null;

            try {
              const deletedSavedTable = await deleteSavedTableRecord(savedTableId);

              setSavedTables((current) =>
                current.filter((savedTable) => savedTable.id !== deletedSavedTable.id),
              );
              setActiveSavedTableId((current) =>
                current === deletedSavedTable.id ? null : current,
              );
              trackAppEvent(
                "saved_table_deleted",
                withAnalyticsContext(analyticsContext, {
                  source_surface: "saved_table_detail_sheet",
                  success: true,
                  dataset_id: deletedSavedTable.datasetId,
                  saved_table_id: deletedSavedTable.id,
                  saved_row_count: deletedSavedTable.savedRowCount,
                  filter_sections_enabled: getEnabledFilterSections(
                    deletedSavedTable.filters,
                  ),
                }),
              );
            } catch (error) {
              if (savedTableToDelete) {
                trackAppEvent(
                  "saved_table_deleted",
                  withAnalyticsContext(analyticsContext, {
                    source_surface: "saved_table_detail_sheet",
                    success: false,
                    error_code: "saved_table_delete_failed",
                    dataset_id: savedTableToDelete.datasetId,
                    saved_table_id: savedTableToDelete.id,
                    saved_row_count: savedTableToDelete.savedRowCount,
                    filter_sections_enabled: getEnabledFilterSections(
                      savedTableToDelete.filters,
                    ),
                  }),
                );
              }
              throw error;
            } finally {
              setDeletingSavedTableId(null);
            }
          }}
        />
      ) : null}
    </>
  );
}
