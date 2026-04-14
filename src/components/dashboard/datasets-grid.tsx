"use client";

import { FileTextIcon, GripVerticalIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  Sortable,
  SortableItem,
  SortableItemHandle,
} from "@/components/reui/sortable";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DatasetSummary } from "@/lib/api-types";
import { cn } from "@/lib/utils";

type DatasetsGridProps = {
  datasets: DatasetSummary[];
  canManageDatasets: boolean;
  isBusy?: boolean;
  onEditDataset?: (datasetId: string) => void;
  onReorderDatasets?: (datasets: DatasetSummary[]) => void;
};

const DATASET_GRID_TEMPLATE_COLUMNS =
  "minmax(18rem,1.7fr) minmax(12rem,max-content) auto";

function datasetMatchesSearch(dataset: DatasetSummary, value: unknown) {
  const query = String(value ?? "").trim().toLowerCase();

  if (!query) return true;

  return [dataset.fileName, String(dataset.rowCount)].some((item) =>
    item.toLowerCase().includes(query),
  );
}

function DatasetActions({
  dataset,
  canManageDatasets,
  isBusy,
  onEditDataset,
}: {
  dataset: DatasetSummary;
  canManageDatasets: boolean;
  isBusy: boolean;
  onEditDataset?: (datasetId: string) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Link
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7")}
        href={`/dashboard/datasets/${dataset.id}`}
      >
        View
      </Link>
      <a
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7")}
        href={`/api/datasets/${dataset.id}/download`}
      >
        Download
      </a>
      {canManageDatasets ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7"
          disabled={isBusy}
          onClick={() => onEditDataset?.(dataset.id)}
        >
          Edit
        </Button>
      ) : null}
      {canManageDatasets ? (
        <Link
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7")}
          href={`/dashboard/upload?replace=${dataset.id}`}
        >
          Replace
        </Link>
      ) : null}
    </div>
  );
}

function DatasetListRow({
  dataset,
  canManageDatasets,
  isBusy,
  isSortable,
  onEditDataset,
}: {
  dataset: DatasetSummary;
  canManageDatasets: boolean;
  isBusy: boolean;
  isSortable: boolean;
  onEditDataset?: (datasetId: string) => void;
}) {
  return (
    <div
      className="grid items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/20"
      style={{ gridTemplateColumns: DATASET_GRID_TEMPLATE_COLUMNS }}
    >
      <div className="flex min-w-0 items-center gap-3">
        {canManageDatasets ? (
          isSortable ? (
            <SortableItemHandle className="text-muted-foreground hover:text-foreground">
              <GripVerticalIcon className="size-4" />
            </SortableItemHandle>
          ) : (
            <span className="text-muted-foreground/45">
              <GripVerticalIcon className="size-4" />
            </span>
          )
        ) : null}
        <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{dataset.fileName}</span>
      </div>

      <span className="tabular-nums">{dataset.rowCount.toLocaleString()}</span>

      <DatasetActions
        dataset={dataset}
        canManageDatasets={canManageDatasets}
        isBusy={isBusy}
        onEditDataset={onEditDataset}
      />
    </div>
  );
}

function DatasetListHeader() {
  return (
    <div
      className="grid items-center gap-4 border-b border-border bg-muted/80 px-5 py-3 text-sm font-medium text-foreground"
      style={{ gridTemplateColumns: DATASET_GRID_TEMPLATE_COLUMNS }}
    >
      <span>Name</span>
      <span>People Groups</span>
      <span className="text-right" />
    </div>
  );
}

export function DatasetsGrid({
  datasets,
  canManageDatasets,
  isBusy = false,
  onEditDataset,
  onReorderDatasets,
}: DatasetsGridProps) {
  const [filter, setFilter] = useState("");
  const filteredDatasets = useMemo(
    () => datasets.filter((dataset) => datasetMatchesSearch(dataset, filter)),
    [datasets, filter],
  );

  const canReorderDatasets =
    canManageDatasets &&
    !isBusy &&
    filter.trim().length === 0 &&
    datasets.length > 1 &&
    typeof onReorderDatasets === "function";

  return (
    <section id="datasets" className="space-y-3">
      <div>
        <h2 className="text-lg font-medium">Datasets</h2>
        <p className="text-sm text-muted-foreground">
          View a saved CSV to filter, sort, and scroll rows.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <label className="relative block sm:w-80">
            <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              value={filter}
              placeholder="Filter datasets"
              onChange={(event) => setFilter(event.target.value)}
            />
          </label>
          {canManageDatasets ? (
            <p className="text-xs text-muted-foreground">
              {filter.trim().length > 0
                ? "Clear the filter to reorder datasets."
                : datasets.length > 1
                  ? "Drag and drop datasets to set their display order."
                  : "Add another dataset to enable manual ordering."}
            </p>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-background">
        <DatasetListHeader />

        {filteredDatasets.length === 0 ? (
          <div className="px-5 py-10 text-sm text-muted-foreground">
            {datasets.length === 0
              ? "No datasets have been added yet."
              : "No datasets match your filter."}
          </div>
        ) : canReorderDatasets ? (
          <Sortable
            value={datasets}
            onValueChange={onReorderDatasets}
            getItemValue={(dataset) => dataset.id}
            strategy="vertical"
            className="divide-y divide-border"
          >
            {datasets.map((dataset) => (
              <SortableItem key={dataset.id} value={dataset.id}>
                <DatasetListRow
                  dataset={dataset}
                  canManageDatasets={canManageDatasets}
                  isBusy={isBusy}
                  isSortable
                  onEditDataset={onEditDataset}
                />
              </SortableItem>
            ))}
          </Sortable>
        ) : (
          <div className="divide-y divide-border">
            {filteredDatasets.map((dataset) => (
              <DatasetListRow
                key={dataset.id}
                dataset={dataset}
                canManageDatasets={canManageDatasets}
                isBusy={isBusy}
                isSortable={false}
                onEditDataset={onEditDataset}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
