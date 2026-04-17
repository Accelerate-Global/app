"use client";

import { DownloadIcon, FileTextIcon, GripVerticalIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent } from "react";

import { DatasetTagList } from "@/components/dashboard/dataset-tag-list";
import {
  Sortable,
  SortableItem,
  SortableItemHandle,
} from "@/components/reui/sortable";
import { Button, buttonVariants } from "@/components/ui/button";
import type { DatasetSummary } from "@/lib/api-types";

type DatasetsGridProps = {
  datasets: DatasetSummary[];
  canManageDatasets: boolean;
  isBusy?: boolean;
  onEditDataset?: (datasetId: string) => void;
  onReorderDatasets?: (datasets: DatasetSummary[]) => void;
};

const DATASET_GRID_TEMPLATE_COLUMNS =
  "minmax(16rem,1.8fr) minmax(12rem,1.15fr) minmax(8rem,0.7fr) max-content";

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
    <div className="flex w-full justify-end text-right">
      <div className="flex shrink-0 items-center justify-end gap-2">
        <a
          data-slot="button"
          className={buttonVariants({
            variant: "outline",
            size: "icon-sm",
            className: "shrink-0",
          })}
          href={`/api/datasets/${dataset.id}/download`}
          aria-label={`Download ${dataset.fileName}`}
          title={`Download ${dataset.fileName}`}
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <DownloadIcon />
        </a>
        {canManageDatasets ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={isBusy}
            data-smoke-trigger="dataset-edit-sheet"
            data-smoke-write="safe"
            data-smoke-dataset-id={dataset.id}
            onClick={(event) => {
              event.stopPropagation();
              onEditDataset?.(dataset.id);
            }}
          >
            Edit
          </Button>
        ) : null}
      </div>
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
  const router = useRouter();

  function navigateToDataset() {
    router.push(`/dashboard/datasets/${dataset.id}`);
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigateToDataset();
    }
  }

  function stopHandlePropagation(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  return (
    <div
      data-smoke-dataset-row={dataset.id}
      className="grid cursor-pointer items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      style={{ gridTemplateColumns: DATASET_GRID_TEMPLATE_COLUMNS }}
      role="link"
      tabIndex={0}
      onClick={navigateToDataset}
      onKeyDown={handleRowKeyDown}
    >
      <div className="flex min-w-0 items-center gap-3">
        {canManageDatasets ? (
          isSortable ? (
            <SortableItemHandle
              className="text-muted-foreground hover:text-foreground"
              onClick={stopHandlePropagation}
            >
              <GripVerticalIcon className="size-4" />
            </SortableItemHandle>
          ) : (
            <span className="text-muted-foreground/45">
              <GripVerticalIcon className="size-4" />
            </span>
          )
        ) : null}
        <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
        <span
          className="block truncate font-medium"
          data-smoke-dataset-name={dataset.id}
        >
          {dataset.fileName}
        </span>
      </div>

      <div className="flex min-w-0 w-full justify-center text-center">
        <DatasetTagList tags={dataset.tags} className="justify-center" />
      </div>

      <span className="block w-full text-center tabular-nums">
        {dataset.rowCount.toLocaleString()}
      </span>

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
      <span className="block w-full text-center">Tags</span>
      <span className="block w-full text-center">People Groups</span>
      <span className="block w-full text-right" />
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
  const canReorderDatasets =
    canManageDatasets &&
    Boolean(onReorderDatasets) &&
    !isBusy &&
    datasets.length > 1;

  return (
    <section id="datasets">
      <div className="overflow-x-auto rounded-xl border border-border bg-background">
        <div className="min-w-[54rem]">
          <DatasetListHeader />

          {datasets.length === 0 ? (
            <div className="px-5 py-10 text-sm text-muted-foreground">
              No datasets have been added yet.
            </div>
          ) : canReorderDatasets ? (
            <Sortable
              value={datasets}
              onValueChange={onReorderDatasets!}
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
              {datasets.map((dataset) => (
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
      </div>
    </section>
  );
}
