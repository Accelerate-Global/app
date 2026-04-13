"use client";

import { useState } from "react";

import { DatasetsGrid } from "@/components/dashboard/datasets-grid";
import type { DatasetSummary } from "@/lib/api-types";

type DashboardClientProps = {
  initialDatasets: DatasetSummary[];
  canManageDatasets: boolean;
};

type DatasetResponse = {
  dataset: DatasetSummary;
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

export function DashboardClient({
  initialDatasets,
  canManageDatasets,
}: DashboardClientProps) {
  const [datasets, setDatasets] = useState(initialDatasets);
  const [renamingDatasetId, setRenamingDatasetId] = useState<string | null>(null);

  async function handleRenameDataset(dataset: DatasetSummary) {
    if (!canManageDatasets || renamingDatasetId !== null) {
      return;
    }

    const nextName = window.prompt("Rename dataset", dataset.fileName)?.trim();

    if (!nextName || nextName === dataset.fileName) {
      return;
    }

    setRenamingDatasetId(dataset.id);

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
      const message =
        error instanceof Error
          ? error.message
          : "The dataset name could not be updated.";
      window.alert(message);
    } finally {
      setRenamingDatasetId(null);
    }
  }

  return (
    <DatasetsGrid
      datasets={datasets}
      canManageDatasets={canManageDatasets}
      isBusy={renamingDatasetId !== null}
      onRenameDataset={handleRenameDataset}
      renamingDatasetId={renamingDatasetId}
    />
  );
}
