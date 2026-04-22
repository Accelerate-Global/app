"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { buttonVariants, Button } from "@/components/ui/button";
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
  SavedDatasetFilterState,
} from "@/lib/api-types";
import {
  buildAnalyticsContext,
  getEnabledFilterSections,
  type AppAnalyticsContext,
  withAnalyticsContext,
} from "@/lib/analytics";
import { trackAppEvent } from "@/lib/analytics-client";
import { cn } from "@/lib/utils";

type DatasetAssignDerivedViewSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDataset: DatasetSummary;
  sourceDatasetId: string;
  filters: SavedDatasetFilterState;
  recordCount: number;
  assignableDatasets: DatasetSummary[];
  analyticsContext?: AppAnalyticsContext;
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

function formatFilterSectionLabel(value: string) {
  if (value === "uupg") {
    return "UUPG";
  }

  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function formatFilterSummary(filters: SavedDatasetFilterState) {
  const enabledSections = getEnabledFilterSections(filters);

  if (enabledSections === "none") {
    return "No active filters.";
  }

  return enabledSections
    .split("|")
    .map(formatFilterSectionLabel)
    .join(", ");
}

export function DatasetAssignDerivedViewSheet({
  open,
  onOpenChange,
  currentDataset,
  sourceDatasetId,
  filters,
  recordCount,
  assignableDatasets,
  analyticsContext = buildAnalyticsContext({
    route: "dataset_detail",
    actorOwnerId: "anonymous",
    workspaceRole: "anonymous",
  }),
}: DatasetAssignDerivedViewSheetProps) {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    assignableDatasets[0]?.id ?? null,
  );
  const [assignedDataset, setAssignedDataset] = useState<DatasetSummary | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"default" | "destructive">(
    "default",
  );
  const selectedDataset = useMemo(
    () =>
      assignableDatasets.find((dataset) => dataset.id === selectedDatasetId) ?? null,
    [assignableDatasets, selectedDatasetId],
  );
  const filterSummary = useMemo(() => formatFilterSummary(filters), [filters]);

  useEffect(() => {
    setSelectedDatasetId((current) => {
      if (current && assignableDatasets.some((dataset) => dataset.id === current)) {
        return current;
      }

      return assignableDatasets[0]?.id ?? null;
    });
  }, [assignableDatasets]);

  function resetState() {
    setAssignedDataset(null);
    setMessage(null);
    setMessageTone("default");
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetState();
    }

    onOpenChange(nextOpen);
  }

  async function handleAssign() {
    if (!selectedDataset) {
      return;
    }

    setIsAssigning(true);
    setMessage(null);
    setMessageTone("default");

    try {
      const response = await fetch(
        `/api/datasets/${selectedDataset.id}/assign-derived-view`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sourceDatasetId,
            filters,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(
            response,
            "The filtered dataset could not be assigned.",
          ),
        );
      }

      const payload = (await response.json()) as DatasetResponse;
      setAssignedDataset(payload.dataset);
      setMessage(`Assigned filtered view to "${payload.dataset.fileName}".`);
      trackAppEvent(
        "dataset_assigned",
        withAnalyticsContext(analyticsContext, {
          source_surface: "dataset_assign_sheet",
          success: true,
          dataset_id: payload.dataset.id,
          source_dataset_id: sourceDatasetId,
          target_dataset_id: payload.dataset.id,
          assigned_row_count: payload.dataset.rowCount,
          filter_sections_enabled: getEnabledFilterSections(filters),
          sorting_count: filters.sorting.length,
        }),
      );
    } catch (error) {
      setAssignedDataset(null);
      setMessage(
        error instanceof Error
          ? error.message
          : "The filtered dataset could not be assigned.",
      );
      setMessageTone("destructive");
      trackAppEvent(
        "dataset_assigned",
        withAnalyticsContext(analyticsContext, {
          source_surface: "dataset_assign_sheet",
          success: false,
          error_code: "dataset_assign_failed",
          dataset_id: selectedDataset.id,
          source_dataset_id: sourceDatasetId,
          target_dataset_id: selectedDataset.id,
          filter_sections_enabled: getEnabledFilterSections(filters),
          sorting_count: filters.sorting.length,
        }),
      );
    } finally {
      setIsAssigning(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 sm:max-w-lg"
        data-smoke-surface="dataset-assign-derived-view-sheet"
        data-smoke-ready="dataset-assign-derived-view-sheet"
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-border px-6 py-5">
            <SheetTitle>Assign filtered view</SheetTitle>
            <SheetDescription>
              Save the current filtered result from{" "}
              <span className="font-medium text-foreground">
                {currentDataset.fileName}
              </span>{" "}
              onto an admin-managed dataset as a live derived view.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 py-5">
            <section className="space-y-3 rounded-2xl border border-border bg-card px-4 py-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Current filtered result
                </p>
                <p className="text-sm text-muted-foreground">
                  {recordCount.toLocaleString()} people groups
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Active filters</p>
                <p className="text-sm text-muted-foreground">{filterSummary}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Sort order</p>
                <p className="text-sm text-muted-foreground">
                  {filters.sorting.length > 0
                    ? `${filters.sorting.length} active sort rule${filters.sorting.length === 1 ? "" : "s"}`
                    : "Default row order"}
                </p>
              </div>
            </section>

            <section className="space-y-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="dataset-assign-derived-view-target"
              >
                Target dataset
              </label>
              <Select
                value={selectedDatasetId ?? undefined}
                disabled={isAssigning || assignableDatasets.length === 0}
                onValueChange={(datasetId) => {
                  setAssignedDataset(null);
                  setMessage(null);
                  setMessageTone("default");
                  setSelectedDatasetId(datasetId);
                }}
              >
                <SelectTrigger
                  id="dataset-assign-derived-view-target"
                  className="w-full"
                  data-smoke-assign-derived-view-target
                >
                  <SelectValue placeholder="Select a dataset" />
                </SelectTrigger>
                <SelectContent>
                  {assignableDatasets.map((dataset) => (
                    <SelectItem key={dataset.id} value={dataset.id}>
                      {dataset.fileName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                The target keeps its name and visibility, but its data view will
                follow the current source dataset and filters.
              </p>
            </section>

            {message ? (
              <div className="space-y-3">
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
                {assignedDataset ? (
                  <Link
                    href={`/dashboard/datasets/${assignedDataset.id}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    data-smoke-assign-derived-view-open-target
                  >
                    Open assigned dataset
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>

          <SheetFooter className="border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              disabled={
                isAssigning || !selectedDataset || assignableDatasets.length === 0
              }
              data-smoke-assign-derived-view-submit
              onClick={() => {
                void handleAssign();
              }}
            >
              {isAssigning ? "Assigning..." : "Assign to dataset"}
            </Button>
            <SheetClose
              render={
                <Button type="button" variant="outline" disabled={isAssigning}>
                  Close
                </Button>
              }
            />
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
