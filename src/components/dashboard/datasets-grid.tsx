"use client";

import {
  DownloadIcon,
  FileTextIcon,
  GripVerticalIcon,
  PlusIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from "react";

import { DatasetTagList } from "@/components/dashboard/dataset-tag-list";
import {
  Sortable,
  SortableItem,
  SortableItemHandle,
} from "@/components/reui/sortable";
import { buttonVariants } from "@/components/ui/button";
import type { DatasetSummary } from "@/lib/api-types";

type DatasetsGridProps = {
  datasets: DatasetSummary[];
  canManageDatasets: boolean;
  isBusy?: boolean;
  onReorderDatasets?: (datasets: DatasetSummary[]) => void;
};

const DATASET_ACTIONS_COLUMN_WIDTH = "10.5rem";
const DATASET_GRID_TEMPLATE_COLUMNS =
  `minmax(16rem,1.8fr) minmax(12rem,1.15fr) minmax(8rem,0.7fr) ${DATASET_ACTIONS_COLUMN_WIDTH}`;
const DATASET_GRID_STYLE = {
  "--dataset-grid-template": DATASET_GRID_TEMPLATE_COLUMNS,
} as CSSProperties;

function CenteredHeaderCell({ children }: { children: ReactNode }) {
  return (
    <span className="flex w-full items-center justify-center text-center">
      {children}
    </span>
  );
}

function DatasetActions({
  dataset,
  canManageDatasets,
}: {
  dataset: DatasetSummary;
  canManageDatasets: boolean;
}) {
  return (
    <div className="flex w-full justify-start text-left md:justify-end md:text-right">
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
          <Link
            href={`/dashboard/datasets/${dataset.id}/edit`}
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "shrink-0",
            })}
            data-smoke-write="safe"
            data-smoke-dataset-id={dataset.id}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            Edit
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function DatasetListRow({
  dataset,
  backingDatasetName,
  canManageDatasets,
  isSortable,
}: {
  dataset: DatasetSummary;
  backingDatasetName?: string | null;
  canManageDatasets: boolean;
  isSortable: boolean;
}) {
  const router = useRouter();
  const isDerivedView = dataset.backingDatasetId !== null;

  function navigateToDataset() {
    router.push(`/dashboard/datasets/${dataset.id}?source=dashboard`);
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
      className="grid cursor-pointer grid-cols-[minmax(0,1fr)] items-start gap-3 px-4 py-4 transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:px-5 md:grid-cols-[var(--dataset-grid-template)] md:items-center md:gap-4"
      style={DATASET_GRID_STYLE}
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
        <div className="min-w-0">
          <span
            className="block truncate font-medium"
            data-smoke-dataset-name={dataset.id}
          >
            {dataset.fileName}
          </span>
          {isDerivedView ? (
            <span className="block truncate text-xs text-muted-foreground">
              Backed by {backingDatasetName ?? "another dataset"}
            </span>
          ) : null}
        </div>
      </div>

      <div
        className="flex min-w-0 w-full justify-start text-left md:justify-center md:text-center"
        aria-label={dataset.tags.length > 0 ? `Tags for ${dataset.fileName}` : undefined}
      >
        <DatasetTagList
          tags={dataset.tags}
          className="justify-start md:justify-center"
        />
      </div>

      <div
        className="flex w-full items-center justify-between gap-3 text-sm md:block md:text-center md:text-base"
        aria-label={`${dataset.rowCount.toLocaleString()} people groups`}
      >
        <span className="text-xs font-medium text-muted-foreground md:hidden">
          People Groups
        </span>
        <span className="tabular-nums">{dataset.rowCount.toLocaleString()}</span>
      </div>

      <DatasetActions
        dataset={dataset}
        canManageDatasets={canManageDatasets}
      />
    </div>
  );
}

function DatasetListHeader() {
  return (
    <div
      className="hidden items-center gap-4 border-b border-border bg-muted/80 px-5 py-3 text-sm font-medium text-foreground md:grid md:grid-cols-[var(--dataset-grid-template)]"
      style={DATASET_GRID_STYLE}
    >
      <span>Name</span>
      <CenteredHeaderCell>Tags</CenteredHeaderCell>
      <CenteredHeaderCell>People Groups</CenteredHeaderCell>
      <span className="block w-full text-right" />
    </div>
  );
}

export function DatasetsGrid({
  datasets,
  canManageDatasets,
  isBusy = false,
  onReorderDatasets,
}: DatasetsGridProps) {
  const datasetNameById = new Map(datasets.map((dataset) => [dataset.id, dataset.fileName]));
  const canReorderDatasets =
    canManageDatasets &&
    Boolean(onReorderDatasets) &&
    !isBusy &&
    datasets.length > 1;

  return (
    <section id="datasets" className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">
            Datasets
          </h2>
          <p className="text-sm text-muted-foreground">
            Source datasets and derived views available to browse, download, and manage.
          </p>
        </div>
        {canManageDatasets ? (
          <Link
            href="/dashboard/datasets/new"
            className={buttonVariants({ size: "sm" })}
          >
            <PlusIcon />
            Add dataset
          </Link>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-background md:overflow-x-auto">
        <div className="md:min-w-[54rem]">
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
                    backingDatasetName={
                      dataset.backingDatasetId
                        ? datasetNameById.get(dataset.backingDatasetId) ?? null
                        : null
                    }
                    canManageDatasets={canManageDatasets}
                    isSortable
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
                  backingDatasetName={
                    dataset.backingDatasetId
                      ? datasetNameById.get(dataset.backingDatasetId) ?? null
                      : null
                  }
                  canManageDatasets={canManageDatasets}
                  isSortable={false}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
