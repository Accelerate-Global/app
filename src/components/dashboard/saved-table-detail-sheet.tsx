"use client";

import { Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { DatasetSummary, SavedDatasetTable } from "@/lib/api-types";
import { buildPopulationBelieversRuleSummaryLines } from "@/lib/evangelical-population-believers-rule";
import { normalizeRegionDisplayName } from "@/lib/region-display";
import { normalizeSavedDatasetFilterState } from "@/lib/saved-dataset-filters";

type SavedTableDetailSheetProps = {
  savedTable: SavedDatasetTable;
  dataset: DatasetSummary | null;
  open: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveSavedTable: (input: {
    savedTableId: string;
    name: string;
    details: string;
  }) => Promise<void>;
  onDeleteSavedTable: (savedTableId: string) => Promise<void>;
};

function formatSavedAt(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getRegionSummary(savedTable: SavedDatasetTable) {
  const normalizedFilters = normalizeSavedDatasetFilterState(savedTable.filters);

  if (normalizedFilters.region.selectedRegionNames.length === 0) {
    return normalizedFilters.region.enabledCountryNames.length > 0 ||
      normalizedFilters.region.enabled
      ? "Global"
      : "Off";
  }

  return normalizedFilters.region.selectedRegionNames
    .map((regionName) => normalizeRegionDisplayName(regionName))
    .join(", ");
}

function getWatchlistSummary(savedTable: SavedDatasetTable) {
  const normalizedFilters = normalizeSavedDatasetFilterState(savedTable.filters);

  if (!normalizedFilters.watchlist.enabled) {
    return "Off";
  }

  const summary: string[] = [];

  if (normalizedFilters.watchlist.thresholdEnabled ?? true) {
    summary.push(`Christianity: GSEC <= ${normalizedFilters.watchlist.threshold}`);
  }

  if (normalizedFilters.watchlist.frontierGroupEnabled ?? true) {
    summary.push(
      `Frontier Group = ${
        normalizedFilters.watchlist.frontierGroupValue ? "True" : "False"
      }`,
    );
  }

  if (normalizedFilters.watchlist.evangelicalPopulationBelieversRuleEnabled) {
    summary.push(
      ...buildPopulationBelieversRuleSummaryLines(
        normalizedFilters.watchlist.evangelicalPopulationBelieversRule,
      ),
    );
  } else if (normalizedFilters.watchlist.evangelicalPercentEnabled ?? false) {
    summary.push(
      `Min. Evangelical % >= ${normalizedFilters.watchlist.evangelicalPercentThreshold}`,
    );
  }

  if (normalizedFilters.watchlist.engagementPhaseEnabled ?? true) {
    summary.push(
      `Engage: 8 Phases >= ${normalizedFilters.watchlist.engagementPhaseThreshold}`,
    );
  }

  return summary.length > 0 ? summary.join("; ") : "No criteria selected";
}

function getCountrySummary(savedTable: SavedDatasetTable) {
  if (!savedTable.filters.country.enabled) {
    return "Off";
  }

  if (savedTable.filters.country.selectedCountryNames.length === 0) {
    return "All countries";
  }

  return savedTable.filters.country.selectedCountryNames.join(", ");
}

function getSortingSummary(savedTable: SavedDatasetTable, dataset: DatasetSummary | null) {
  if (savedTable.filters.sorting.length === 0) {
    return "Default dataset order";
  }

  const columnLabelByKey = new Map(
    (dataset?.columns ?? []).map((column) => [column.key, column.label]),
  );

  return savedTable.filters.sorting
    .map((sort) => {
      const columnLabel = columnLabelByKey.get(sort.id) ?? sort.id;
      return `${columnLabel} ${sort.desc ? "descending" : "ascending"}`;
    })
    .join(", ");
}

export function SavedTableDetailSheet({
  savedTable,
  dataset,
  open,
  isSaving,
  isDeleting,
  onOpenChange,
  onSaveSavedTable,
  onDeleteSavedTable,
}: SavedTableDetailSheetProps) {
  const [name, setName] = useState(savedTable.name);
  const [details, setDetails] = useState(savedTable.details);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isWorking = isSaving || isDeleting;
  const trimmedName = name.trim();
  const trimmedDetails = details.trim();
  const canSave = Boolean(
    trimmedName &&
      !isWorking &&
      (trimmedName !== savedTable.name || trimmedDetails !== savedTable.details),
  );
  const savedAt = useMemo(() => formatSavedAt(savedTable.createdAt), [savedTable.createdAt]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trimmedName) {
      setErrorMessage("The saved table name cannot be empty.");
      return;
    }

    try {
      setErrorMessage(null);
      await onSaveSavedTable({
        savedTableId: savedTable.id,
        name: trimmedName,
        details: trimmedDetails,
      });
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The saved table could not be updated.",
      );
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete the saved table "${savedTable.name}"?`)) {
      return;
    }

    try {
      setErrorMessage(null);
      await onDeleteSavedTable(savedTable.id);
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The saved table could not be deleted.",
      );
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 sm:max-w-lg"
        data-smoke-surface="saved-table-detail-sheet"
        data-smoke-ready="saved-table-detail-sheet"
      >
        <form className="flex h-full flex-col" onSubmit={handleSubmit}>
          <SheetHeader className="border-b border-border px-6 py-5">
            <SheetTitle>Saved table details</SheetTitle>
            <SheetDescription>
              Review and update the saved filtered table shown on your dashboard.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 py-5">
            <section className="space-y-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="saved-table-name"
              >
                Saved table name
              </label>
              <Input
                id="saved-table-name"
                value={name}
                disabled={isWorking}
                data-smoke-saved-table-name-input
                onChange={(event) => setName(event.target.value)}
              />
            </section>

            <section className="space-y-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="saved-table-details"
              >
                Details
              </label>
              <textarea
                id="saved-table-details"
                value={details}
                disabled={isWorking}
                rows={5}
                className="flex min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                data-smoke-saved-table-details-input
                placeholder="Add notes about why this filtered table was saved."
                onChange={(event) => setDetails(event.target.value)}
              />
            </section>

            <section className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Saved metadata
              </p>
              <dl className="grid gap-4 rounded-2xl border border-border bg-card px-4 py-4">
                <div className="space-y-1">
                  <dt className="text-sm font-medium text-foreground">Source dataset</dt>
                  <dd className="text-sm text-muted-foreground">
                    {dataset?.fileName ?? savedTable.datasetFileName}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-sm font-medium text-foreground">People groups</dt>
                  <dd className="text-sm text-muted-foreground">
                    {savedTable.savedRowCount.toLocaleString()}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-sm font-medium text-foreground">Saved</dt>
                  <dd className="text-sm text-muted-foreground">{savedAt}</dd>
                </div>
              </dl>
            </section>

            <section className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Filters
              </p>
              <dl className="grid gap-4 rounded-2xl border border-border bg-card px-4 py-4">
                <div className="space-y-1">
                  <dt className="text-sm font-medium text-foreground">Region</dt>
                  <dd className="text-sm text-muted-foreground">
                    {getRegionSummary(savedTable)}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-sm font-medium text-foreground">Country</dt>
                  <dd className="text-sm text-muted-foreground">
                    {getCountrySummary(savedTable)}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-sm font-medium text-foreground">Watchlist</dt>
                  <dd className="text-sm text-muted-foreground">
                    {getWatchlistSummary(savedTable)}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-sm font-medium text-foreground">UUPG</dt>
                  <dd className="text-sm text-muted-foreground">
                    {savedTable.filters.uupg.enabled ? "Enabled" : "Off"}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-sm font-medium text-foreground">Sorting</dt>
                  <dd className="text-sm text-muted-foreground">
                    {getSortingSummary(savedTable, dataset)}
                  </dd>
                </div>
              </dl>
            </section>

            {errorMessage ? (
              <p className="text-sm text-destructive">{errorMessage}</p>
            ) : null}
          </div>

          <SheetFooter className="border-t border-border px-6 py-5">
            <div className="flex w-full items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={isWorking}
                onClick={() => {
                  void handleDelete();
                }}
              >
                <Trash2Icon />
                Delete saved table
              </Button>
              <Button type="submit" disabled={!canSave} data-smoke-saved-table-save>
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
