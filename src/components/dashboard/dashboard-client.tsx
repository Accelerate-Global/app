"use client";

import { useState } from "react";

import { DatasetEditDrawer } from "@/components/dashboard/dataset-edit-drawer";
import { DatasetsGrid } from "@/components/dashboard/datasets-grid";
import type { DatasetSummary, DatasetTag } from "@/lib/api-types";
import { getReusableDatasetTags } from "@/lib/dataset-tags";

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
          key={`${editingDataset.id}:${editingDataset.updatedAt}`}
          dataset={editingDataset}
          availableTags={availableTags}
          isSaving={editingDataset?.id === updatingDatasetId}
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setEditingDatasetId(null);
            }
          }}
          onSaveDataset={handleSaveDataset}
        />
      ) : null}
    </>
  );
}
