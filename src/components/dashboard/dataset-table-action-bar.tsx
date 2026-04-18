"use client";

import { DownloadIcon, SaveIcon, SlidersHorizontalIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  DatasetRowsResponse,
  DatasetSummary,
  DatasetTag,
  FieldDefinitionPresentation,
  SavedDatasetFilterState,
  SavedDatasetTableResponse,
} from "@/lib/api-types";
import {
  buildAnalyticsContext,
  getEnabledFilterSections,
  type AppAnalyticsContext,
  withAnalyticsContext,
} from "@/lib/analytics";
import { trackAppEvent } from "@/lib/analytics-client";
import {
  getFilteredDatasetDownloadFileName,
  serializeDatasetRowsToCsv,
} from "@/lib/dataset-download";

type DatasetRow = DatasetRowsResponse["rows"][number];

type DatasetOpenPresetControls = {
  tags: DatasetTag[];
  selectedTagId: string | null;
  isSaving: boolean;
  onSelectedTagIdChange: (tagId: string | null) => void;
  onSave: () => Promise<void>;
  onClear: () => Promise<void>;
};

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
  analyticsContext?: AppAnalyticsContext;
  onOpenFilters?: () => void;
  openPresetControls?: DatasetOpenPresetControls;
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
  analyticsContext = buildAnalyticsContext({
    route: "dataset_detail",
    actorOwnerId: "anonymous",
    workspaceRole: "anonymous",
  }),
  onOpenFilters,
  openPresetControls,
}: DatasetTableActionBarProps) {
  const [isSavingSavedTable, setIsSavingSavedTable] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"default" | "destructive">(
    "default",
  );
  const isSavingPreset = openPresetControls?.isSaving ?? false;
  const isDisabled = isLoading || hasError || isSavingSavedTable || isSavingPreset;
  const hasPresetTag = openPresetControls?.tags.some(
    (tag) => tag.openPreset !== undefined,
  );
  const selectedPresetTag = openPresetControls?.tags.find(
    (tag) => tag.id === openPresetControls.selectedTagId,
  );
  const presetBearingTag =
    openPresetControls?.tags.find((tag) => tag.openPreset !== undefined) ?? null;

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
    trackAppEvent(
      "dataset_downloaded",
      withAnalyticsContext(analyticsContext, {
        source_surface: "dataset_action_bar",
        success: true,
        dataset_id: dataset.id,
        filtered_row_count: recordCount,
        visible_column_count: visibleColumns.length,
      }),
    );
    setMessage(null);
    setMessageTone("default");
  }

  async function handleSave() {
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
      trackAppEvent(
        "saved_table_created",
        withAnalyticsContext(analyticsContext, {
          source_surface: "dataset_action_bar",
          success: true,
          dataset_id: dataset.id,
          saved_table_id: payload.savedTable.id,
          saved_row_count: recordCount,
          filter_sections_enabled: getEnabledFilterSections(filters),
        }),
      );
    } catch (error) {
      trackAppEvent(
        "saved_table_created",
        withAnalyticsContext(analyticsContext, {
          source_surface: "dataset_action_bar",
          success: false,
          error_code: "saved_table_create_failed",
          dataset_id: dataset.id,
          saved_row_count: recordCount,
          filter_sections_enabled: getEnabledFilterSections(filters),
        }),
      );
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

  async function handleSaveOpenPreset() {
    if (!openPresetControls || !selectedPresetTag) {
      return;
    }

    setMessage(null);
    setMessageTone("default");

    try {
      await openPresetControls.onSave();
      setMessage(`Saved open preset to "${selectedPresetTag.label}".`);
      setMessageTone("default");
      trackAppEvent(
        "dataset_open_preset_saved",
        withAnalyticsContext(analyticsContext, {
          source_surface: "dataset_action_bar",
          success: true,
          dataset_id: dataset.id,
          tag_id: selectedPresetTag.id,
          filter_sections_enabled: getEnabledFilterSections(filters),
        }),
      );
    } catch (error) {
      trackAppEvent(
        "dataset_open_preset_saved",
        withAnalyticsContext(analyticsContext, {
          source_surface: "dataset_action_bar",
          success: false,
          error_code: "dataset_open_preset_save_failed",
          dataset_id: dataset.id,
          tag_id: selectedPresetTag.id,
          filter_sections_enabled: getEnabledFilterSections(filters),
        }),
      );
      setMessage(
        error instanceof Error
          ? error.message
          : "The dataset open preset could not be saved.",
      );
      setMessageTone("destructive");
    }
  }

  async function handleClearOpenPreset() {
    if (!openPresetControls || !hasPresetTag) {
      return;
    }

    setMessage(null);
    setMessageTone("default");

    try {
      await openPresetControls.onClear();
      setMessage("Cleared the dataset open preset.");
      setMessageTone("default");
      trackAppEvent(
        "dataset_open_preset_cleared",
        withAnalyticsContext(analyticsContext, {
          source_surface: "dataset_action_bar",
          success: true,
          dataset_id: dataset.id,
          tag_id: presetBearingTag?.id,
        }),
      );
    } catch (error) {
      trackAppEvent(
        "dataset_open_preset_cleared",
        withAnalyticsContext(analyticsContext, {
          source_surface: "dataset_action_bar",
          success: false,
          error_code: "dataset_open_preset_clear_failed",
          dataset_id: dataset.id,
          tag_id: presetBearingTag?.id,
        }),
      );
      setMessage(
        error instanceof Error
          ? error.message
          : "The dataset open preset could not be cleared.",
      );
      setMessageTone("destructive");
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
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

        <div className="flex flex-col gap-3 lg:items-end">
          {openPresetControls ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-background/70 px-3 py-3 sm:min-w-[22rem]">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Dataset open preset
                </p>
                <p className="text-sm text-muted-foreground">
                  Save the current filters onto one dataset tag so this view opens pre-filtered.
                </p>
              </div>
              {openPresetControls.tags.length > 0 ? (
                <>
                  <div className="space-y-2">
                    <label
                      className="text-sm font-medium text-foreground"
                      htmlFor="dataset-open-preset-tag"
                    >
                      Preset tag
                    </label>
                    <Select
                      value={openPresetControls.selectedTagId ?? undefined}
                      disabled={isDisabled}
                      onValueChange={openPresetControls.onSelectedTagIdChange}
                    >
                      <SelectTrigger
                        id="dataset-open-preset-tag"
                        className="w-full"
                      >
                        <SelectValue placeholder="Select a tag" />
                      </SelectTrigger>
                      <SelectContent align="end">
                        {openPresetControls.tags.map((tag) => (
                          <SelectItem key={tag.id} value={tag.id}>
                            {tag.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isDisabled || !selectedPresetTag}
                      onClick={() => {
                        void handleSaveOpenPreset();
                      }}
                    >
                      {isSavingPreset ? "Saving..." : "Save open preset"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isDisabled || !hasPresetTag}
                      onClick={() => {
                        void handleClearOpenPreset();
                      }}
                    >
                      Clear preset
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Add a dataset tag from Edit dataset before saving an open preset.
                </p>
              )}
            </div>
          ) : null}

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
              {isSavingSavedTable ? "Saving..." : "Save to dashboard"}
            </Button>
          </div>
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
