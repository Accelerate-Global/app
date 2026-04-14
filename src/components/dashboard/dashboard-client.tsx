"use client";

import { useState } from "react";

import { DatasetEditDrawer } from "@/components/dashboard/dataset-edit-drawer";
import { DatasetsGrid } from "@/components/dashboard/datasets-grid";
import type { DatasetSummary } from "@/lib/api-types";

type DashboardClientProps = {
  initialDatasets: DatasetSummary[];
  canManageDatasets: boolean;
};

type DatasetResponse = {
  dataset: DatasetSummary;
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

async function renameDatasetRecord(input: {
  datasetId: string;
  fileName: string;
}) {
  const response = await fetch(`/api/datasets/${input.datasetId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: input.fileName }),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, "The dataset name could not be updated."),
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

export function DashboardClient({
  initialDatasets,
  canManageDatasets,
}: DashboardClientProps) {
  const [datasets, setDatasets] = useState(initialDatasets);
  const [editingDatasetId, setEditingDatasetId] = useState<string | null>(null);
  const [updatingDatasetId, setUpdatingDatasetId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  const editingDataset =
    editingDatasetId === null
      ? null
      : datasets.find((dataset) => dataset.id === editingDatasetId) ?? null;

  async function handleRenameDataset(input: {
    datasetId: string;
    fileName: string;
  }) {
    if (!canManageDatasets || updatingDatasetId !== null) {
      return;
    }

    const dataset = datasets.find((item) => item.id === input.datasetId);
    const nextName = input.fileName.trim();

    if (!dataset || !nextName || nextName === dataset.fileName) {
      return;
    }

    setUpdatingDatasetId(dataset.id);

    try {
      const updatedDataset = await renameDatasetRecord({
        datasetId: dataset.id,
        fileName: nextName,
      });

      setDatasets((current) =>
        current.map((item) =>
          item.id === updatedDataset.id ? updatedDataset : item,
        ),
      );
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "The dataset name could not be updated.",
      );
    } finally {
      setUpdatingDatasetId(null);
    }
  }

  async function handleReorderDatasets(nextDatasets: DatasetSummary[]) {
    if (!canManageDatasets || updatingDatasetId !== null || isReordering) {
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
      <DatasetsGrid
        datasets={datasets}
        canManageDatasets={canManageDatasets}
        isBusy={updatingDatasetId !== null || isReordering}
        onEditDataset={setEditingDatasetId}
        onReorderDatasets={handleReorderDatasets}
      />
      {canManageDatasets && editingDataset ? (
        <DatasetEditDrawer
          dataset={editingDataset}
          isSaving={editingDataset?.id === updatingDatasetId}
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setEditingDatasetId(null);
            }
          }}
          onSaveDatasetName={handleRenameDataset}
        />
      ) : null}
    </>
  );
}
