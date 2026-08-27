"use client";

import {
  DownloadIcon,
  PanelRightOpenIcon,
  SaveIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type {
  DatasetRowsResponse,
  DatasetSummary,
  FieldDefinitionPresentation,
  SavedDatasetFilterState,
  SavedDatasetTableResponse,
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
  getSortedRows: () => DatasetRow[];
  visibleColumns: DatasetSummary["columns"];
  isLoading: boolean;
  hasError: boolean;
  fieldDefinitionPresentationByColumnKey: Record<
    string,
    FieldDefinitionPresentation
  >;
  canSaveFilteredTable?: boolean;
  onOpenFilters?: () => void;
  onOpenAssignDerivedView?: () => void;
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
  getSortedRows,
  visibleColumns,
  isLoading,
  hasError,
  fieldDefinitionPresentationByColumnKey,
  canSaveFilteredTable = true,
  onOpenFilters,
  onOpenAssignDerivedView,
}: DatasetTableActionBarProps) {
  const [isSavingSavedTable, setIsSavingSavedTable] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"default" | "destructive">(
    "default",
  );
  const isDisabled = isLoading || hasError || isSavingSavedTable;

  function handleDownload() {
    const csv = serializeDatasetRowsToCsv({
      rows: getSortedRows(),
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
    if (!canSaveFilteredTable) {
      return;
    }

    setIsSavingSavedTable(true);
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

      const payload = (await response.json()) as SavedDatasetTableResponse;

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
      setIsSavingSavedTable(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card px-4 py-4">
      <div className="space-y-4">
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Current filtered table
          </p>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p
              className="text-2xl font-semibold tracking-[-0.04em] text-foreground"
              data-smoke-filtered-table-count
            >
              {isLoading ? "..." : recordCount.toLocaleString()}
            </p>
            <p className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
              People Groups
            </p>
          </div>
        </div>

        <div
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          data-smoke-filtered-table-actions
        >
          {onOpenFilters ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full text-xs xl:hidden"
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
            size="sm"
            variant="outline"
            className="w-full text-xs"
            disabled={isDisabled}
            data-smoke-filtered-table-download
            onClick={handleDownload}
          >
            <DownloadIcon />
            Download
          </Button>
          {canSaveFilteredTable ? (
            <Button
              type="button"
              size="sm"
              className="w-full text-xs"
              disabled={isDisabled}
              data-smoke-save-filtered-table
              onClick={() => {
                void handleSave();
              }}
            >
              <SaveIcon />
              {isSavingSavedTable ? "Saving..." : "Save to dashboard"}
            </Button>
          ) : null}
          {onOpenAssignDerivedView ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="col-span-full w-full text-xs"
              data-smoke-trigger="dataset-assign-derived-view-sheet"
              data-smoke-write="safe"
              onClick={onOpenAssignDerivedView}
            >
              <PanelRightOpenIcon />
              Assign to dataset
            </Button>
          ) : null}
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
