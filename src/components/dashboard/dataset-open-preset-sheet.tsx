"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  DatasetSummary,
  DatasetTag,
  SavedDatasetFilterState,
} from "@/lib/api-types";
import {
  buildAnalyticsContext,
  getEnabledFilterSections,
  type AppAnalyticsContext,
  withAnalyticsContext,
} from "@/lib/analytics";
import { trackAppEvent } from "@/lib/analytics-client";

type DatasetOpenPresetSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataset: DatasetSummary;
  filters: SavedDatasetFilterState;
  tags: DatasetTag[];
  selectedTagId: string | null;
  isSaving: boolean;
  analyticsContext?: AppAnalyticsContext;
  onSelectedTagIdChange: (tagId: string | null) => void;
  onSave: () => Promise<void>;
  onClear: () => Promise<void>;
};

export function DatasetOpenPresetSheet({
  open,
  onOpenChange,
  dataset,
  filters,
  tags,
  selectedTagId,
  isSaving,
  analyticsContext = buildAnalyticsContext({
    route: "dataset_detail",
    actorOwnerId: "anonymous",
    workspaceRole: "anonymous",
  }),
  onSelectedTagIdChange,
  onSave,
  onClear,
}: DatasetOpenPresetSheetProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"default" | "destructive">(
    "default",
  );
  const selectedPresetTag = tags.find((tag) => tag.id === selectedTagId);
  const presetBearingTag = tags.find((tag) => tag.openPreset !== undefined) ?? null;
  const hasPresetTag = presetBearingTag !== null;

  function resetMessage() {
    setMessage(null);
    setMessageTone("default");
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetMessage();
    }

    onOpenChange(nextOpen);
  }

  async function handleSaveOpenPreset() {
    if (!selectedPresetTag) {
      return;
    }

    resetMessage();

    try {
      await onSave();
      setMessage(`Saved open preset to "${selectedPresetTag.label}".`);
      trackAppEvent(
        "dataset_open_preset_saved",
        withAnalyticsContext(analyticsContext, {
          source_surface: "dataset_open_preset_sheet",
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
          source_surface: "dataset_open_preset_sheet",
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
    if (!hasPresetTag) {
      return;
    }

    resetMessage();

    try {
      await onClear();
      setMessage("Cleared the dataset open preset.");
      trackAppEvent(
        "dataset_open_preset_cleared",
        withAnalyticsContext(analyticsContext, {
          source_surface: "dataset_open_preset_sheet",
          success: true,
          dataset_id: dataset.id,
          tag_id: presetBearingTag?.id,
        }),
      );
    } catch (error) {
      trackAppEvent(
        "dataset_open_preset_cleared",
        withAnalyticsContext(analyticsContext, {
          source_surface: "dataset_open_preset_sheet",
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
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 sm:max-w-lg"
        data-smoke-surface="dataset-open-preset-sheet"
        data-smoke-ready="dataset-open-preset-sheet"
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-border px-6 py-5">
            <SheetTitle>Dataset open preset</SheetTitle>
            <SheetDescription>
              Save the current filters onto one dataset tag so this view opens
              pre-filtered.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 py-5">
            {tags.length > 0 ? (
              <section className="space-y-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="dataset-open-preset-tag"
                >
                  Preset tag
                </label>
                <Select
                  value={selectedTagId ?? undefined}
                  disabled={isSaving}
                  onValueChange={(tagId) => {
                    resetMessage();
                    onSelectedTagIdChange(tagId);
                  }}
                >
                  <SelectTrigger id="dataset-open-preset-tag" className="w-full">
                    <SelectValue placeholder="Select a tag" />
                  </SelectTrigger>
                  <SelectContent>
                    {tags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        {tag.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </section>
            ) : (
              <p className="text-sm text-muted-foreground">
                Add a dataset tag from Edit dataset before saving an open preset.
              </p>
            )}

            {message ? (
              <p
                className={
                  messageTone === "destructive"
                    ? "text-sm text-destructive"
                    : "text-sm text-muted-foreground"
                }
                role="status"
              >
                {message}
              </p>
            ) : null}
          </div>

          <SheetFooter className="border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
            {tags.length > 0 ? (
              <>
                <Button
                  type="button"
                  disabled={isSaving || !selectedPresetTag}
                  onClick={() => {
                    void handleSaveOpenPreset();
                  }}
                >
                  {isSaving ? "Saving..." : "Save open preset"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving || !hasPresetTag}
                  onClick={() => {
                    void handleClearOpenPreset();
                  }}
                >
                  Clear preset
                </Button>
              </>
            ) : null}
            <SheetClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  data-smoke-close="dataset-open-preset-sheet"
                />
              }
            >
              Close
            </SheetClose>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
