"use client";

import { DownloadIcon, SaveIcon, SlidersHorizontalIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type {
  DatasetRowsResponse,
  DatasetSummary,
  FieldDefinitionPresentation,
  SavedDatasetFilterState,
} from "@/lib/api-types";
import {
  getFilteredDatasetDownloadFileName,
  serializeDatasetRowsToCsv,
} from "@/lib/dataset-download";

type DatasetRow = DatasetRowsResponse["rows"][number];

type DatasetTableActionBarProps = {
  dataset: DatasetSummary;
  filters: SavedDatasetFilterState;
  recordCount: number;
  sortedRows: DatasetRow[];
  visibleColumns: DatasetSummary["columns"];
  isLoading: boolean;
  hasError: boolean;
  fieldDefinitionPresentationByColumnKey: Record<
    string,
    FieldDefinitionPresentation
  >;
  onOpenFilters?: () => void;
};

function downloadCsvFile(input: {
  fileName: string;
  csv: string;
}) {
  const blob = new Blob([input.csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = input.fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function DatasetTableActionBar({
  dataset,
  filters,
  recordCount,
  sortedRows,
  visibleColumns,
  isLoading,
  hasError,
  fieldDefinitionPresentationByColumnKey,
  onOpenFilters,
}: DatasetTableActionBarProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"default" | "destructive">(
    "default",
  );
  const isDisabled = isLoading || hasError || isSaving;

  function handleDownload() {
    const csv = serializeDatasetRowsToCsv({
      rows: sortedRows,
      visibleColumns,
      fieldDefinitionPresentationByColumnKey,
    });

    downloadCsvFile({
      fileName: getFilteredDatasetDownloadFileName(dataset.fileName),
      csv,
    });
    setMessage(null);
    setMessageTone("default");
  }

  async function handleSave() {
    setIsSaving(true);
    setMessage(null);
    setMessageTone("default");

    try {
      const response = await fetch("/api/saved-tables", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          datasetId: dataset.id,
          savedRowCount: recordCount,
          filters,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error || "The filtered table could not be saved.");
      }

      const payload = (await response.json()) as {
        savedTable: {
          name: string;
        };
      };

      setMessage(`Saved to dashboard as "${payload.savedTable.name}".`);
      setMessageTone("default");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The filtered table could not be saved.",
      );
      setMessageTone("destructive");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Current filtered table
          </p>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p
              className="text-3xl font-semibold tracking-[-0.04em] text-foreground"
              data-smoke-filtered-table-count
            >
              {isLoading ? "..." : recordCount.toLocaleString()}
            </p>
            <p className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
              People Groups
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenFilters ? (
            <Button
              type="button"
              variant="outline"
              className="xl:hidden"
              data-smoke-trigger="dataset-filters-sheet"
              data-smoke-write="safe"
              onClick={onOpenFilters}
            >
              <SlidersHorizontalIcon />
              Filters
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={isDisabled}
            data-smoke-filtered-table-download
            onClick={handleDownload}
          >
            <DownloadIcon />
            Download
          </Button>
          <Button
            type="button"
            disabled={isDisabled}
            data-smoke-save-filtered-table
            onClick={() => {
              void handleSave();
            }}
          >
            <SaveIcon />
            {isSaving ? "Saving..." : "Save to dashboard"}
          </Button>
        </div>
      </div>

      {message ? (
        <p
          className={
            messageTone === "destructive"
              ? "mt-3 text-sm text-destructive"
              : "mt-3 text-sm text-muted-foreground"
          }
          role="status"
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
