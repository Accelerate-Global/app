"use client";

import { useState } from "react";

import { DatasetsGrid } from "@/components/dashboard/datasets-grid";
import { SavedTableDetailSheet } from "@/components/dashboard/saved-table-detail-sheet";
import { SavedTablesGrid } from "@/components/dashboard/saved-tables-grid";
import type { DatasetSummary, SavedDatasetTable } from "@/lib/api-types";

type DashboardClientProps = {
  initialDatasets: DatasetSummary[];
  initialSavedTables: SavedDatasetTable[];
  canManageDatasets: boolean;
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
    } catch (error) {
      setDatasets(previousDatasets);
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

            try {
              const updatedSavedTable = await updateSavedTableRecord(input);

              setSavedTables((current) =>
                current.map((savedTable) =>
                  savedTable.id === updatedSavedTable.id
                    ? updatedSavedTable
                    : savedTable,
                ),
              );
            } finally {
              setUpdatingSavedTableId(null);
            }
          }}
          onDeleteSavedTable={async (savedTableId) => {
            if (updatingSavedTableId !== null || deletingSavedTableId !== null) {
              return;
            }

            setDeletingSavedTableId(savedTableId);

            try {
              const deletedSavedTable = await deleteSavedTableRecord(savedTableId);

              setSavedTables((current) =>
                current.filter((savedTable) => savedTable.id !== deletedSavedTable.id),
              );
              setActiveSavedTableId((current) =>
                current === deletedSavedTable.id ? null : current,
              );
            } finally {
              setDeletingSavedTableId(null);
            }
          }}
        />
      ) : null}
    </>
  );
}
