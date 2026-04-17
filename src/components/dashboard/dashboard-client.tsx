"use client";

import { useState } from "react";

import { DatasetEditSheet } from "@/components/dashboard/dataset-edit-sheet";
import { DatasetsGrid } from "@/components/dashboard/datasets-grid";
import { SavedTableDetailSheet } from "@/components/dashboard/saved-table-detail-sheet";
import { SavedTablesGrid } from "@/components/dashboard/saved-tables-grid";
import type {
  DatasetSummary,
  DatasetTag,
  SavedDatasetTable,
} from "@/lib/api-types";
import { getReusableDatasetTags } from "@/lib/dataset-tags";

type DashboardClientProps = {
  initialDatasets: DatasetSummary[];
  initialSavedTables: SavedDatasetTable[];
  canManageDatasets: boolean;
};

type DatasetResponse = {
  dataset: DatasetSummary;
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

async function updateDatasetRecord(input: {
  datasetId: string;
  fileName: string;
  tags: DatasetTag[];
  isPrimary: boolean;
  hiddenColumnKeys: string[];
}) {
  const response = await fetch(`/api/datasets/${input.datasetId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: input.fileName,
      tags: input.tags,
      isPrimary: input.isPrimary,
      hiddenColumnKeys: input.hiddenColumnKeys,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        "The dataset details could not be updated.",
      ),
    );
  }

  return ((await response.json()) as DatasetResponse).dataset;
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

async function deleteDatasetRecord(datasetId: string) {
  const response = await fetch(`/api/datasets/${datasetId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, "The dataset could not be deleted."),
    );
  }

  return ((await response.json()) as DatasetResponse).dataset;
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
  const [editingDatasetId, setEditingDatasetId] = useState<string | null>(null);
  const [activeSavedTableId, setActiveSavedTableId] = useState<string | null>(null);
  const [updatingDatasetId, setUpdatingDatasetId] = useState<string | null>(null);
  const [deletingDatasetId, setDeletingDatasetId] = useState<string | null>(null);
  const [updatingSavedTableId, setUpdatingSavedTableId] = useState<string | null>(null);
  const [deletingSavedTableId, setDeletingSavedTableId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  const editingDataset =
    editingDatasetId === null
      ? null
      : datasets.find((dataset) => dataset.id === editingDatasetId) ?? null;
  const activeSavedTable =
    activeSavedTableId === null
      ? null
      : savedTables.find((savedTable) => savedTable.id === activeSavedTableId) ?? null;
  const activeSavedTableDataset =
    activeSavedTable === null
      ? null
      : datasets.find((dataset) => dataset.id === activeSavedTable.datasetId) ?? null;
  const availableTags = getReusableDatasetTags(
    datasets.flatMap((dataset) => dataset.tags),
  );

  async function handleSaveDataset(input: {
    datasetId: string;
    fileName: string;
    tags: DatasetTag[];
    isPrimary: boolean;
    hiddenColumnKeys: string[];
  }) {
    if (!canManageDatasets || updatingDatasetId !== null) {
      return;
    }

    const dataset = datasets.find((item) => item.id === input.datasetId);
    const nextName = input.fileName.trim();
    const nextTags = input.tags;
    const nextIsPrimary = input.isPrimary;
    const nextHiddenColumnKeys = input.hiddenColumnKeys;

    if (
      !dataset ||
      !nextName ||
      (nextName === dataset.fileName &&
        JSON.stringify(nextTags) === JSON.stringify(dataset.tags) &&
        nextIsPrimary === dataset.isPrimary &&
        JSON.stringify(nextHiddenColumnKeys) ===
          JSON.stringify(dataset.hiddenColumnKeys))
    ) {
      return;
    }

    setUpdatingDatasetId(dataset.id);

    try {
      const updatedDataset = await updateDatasetRecord({
        datasetId: dataset.id,
        fileName: nextName,
        tags: nextTags,
        isPrimary: nextIsPrimary,
        hiddenColumnKeys: nextHiddenColumnKeys,
      });

      setDatasets((current) =>
        current.map((item) =>
          item.id === updatedDataset.id
            ? updatedDataset
            : updatedDataset.isPrimary
              ? { ...item, isPrimary: false }
              : item,
        ),
      );
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "The dataset details could not be updated.",
      );
    } finally {
      setUpdatingDatasetId(null);
    }
  }

  async function handleReorderDatasets(nextDatasets: DatasetSummary[]) {
    if (
      !canManageDatasets ||
      updatingDatasetId !== null ||
      deletingDatasetId !== null ||
      isReordering
    ) {
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

  async function handleDeleteDataset(datasetId: string) {
    if (
      !canManageDatasets ||
      updatingDatasetId !== null ||
      deletingDatasetId !== null ||
      isReordering
    ) {
      return;
    }

    setDeletingDatasetId(datasetId);

    try {
      const deletedDataset = await deleteDatasetRecord(datasetId);

      setDatasets((current) =>
        current.filter((item) => item.id !== deletedDataset.id),
      );
      setSavedTables((current) =>
        current.filter((savedTable) => savedTable.datasetId !== deletedDataset.id),
      );
      setEditingDatasetId((current) =>
        current === deletedDataset.id ? null : current,
      );
      if (activeSavedTable?.datasetId === deletedDataset.id) {
        setActiveSavedTableId(null);
      }
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "The dataset could not be deleted.",
      );
    } finally {
      setDeletingDatasetId(null);
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
        isBusy={
          updatingDatasetId !== null ||
          deletingDatasetId !== null ||
          isReordering
        }
        onEditDataset={setEditingDatasetId}
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
      {canManageDatasets && editingDataset ? (
        <DatasetEditSheet
          key={`${editingDataset.id}:${editingDataset.updatedAt}`}
          dataset={editingDataset}
          availableTags={availableTags}
          isSaving={editingDataset?.id === updatingDatasetId}
          isDeleting={editingDataset.id === deletingDatasetId}
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setEditingDatasetId(null);
            }
          }}
          onSaveDataset={handleSaveDataset}
          onDeleteDataset={handleDeleteDataset}
        />
      ) : null}
    </>
  );
}
