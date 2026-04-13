"use client";

import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { FileTextIcon, PencilIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { DataGrid, DataGridContainer } from "@/components/reui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTableVirtual } from "@/components/reui/data-grid/data-grid-table-virtual";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DatasetSummary } from "@/lib/api-types";
import { cn } from "@/lib/utils";

type DatasetsGridProps = {
  datasets: DatasetSummary[];
  canManageDatasets: boolean;
  isBusy?: boolean;
  onRenameDataset?: (dataset: DatasetSummary) => void;
  onRequestReplace?: (dataset: DatasetSummary) => void;
  replacingDatasetId?: string | null;
  renamingDatasetId?: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function datasetMatchesSearch(dataset: DatasetSummary, value: unknown) {
  const query = String(value ?? "").trim().toLowerCase();

  if (!query) return true;

  return [
    dataset.fileName,
    String(dataset.rowCount),
    String(dataset.columns.length),
    formatDate(dataset.createdAt),
  ].some((item) => item.toLowerCase().includes(query));
}

export function DatasetsGrid({
  datasets,
  canManageDatasets,
  isBusy = false,
  onRenameDataset,
  onRequestReplace,
  replacingDatasetId,
  renamingDatasetId,
}: DatasetsGridProps) {
  const [filter, setFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const isReplacingDataset = replacingDatasetId !== null;
  const isRenamingDataset = renamingDatasetId !== null;

  const columns = useMemo<ColumnDef<DatasetSummary>[]>(
    () => [
      {
        accessorKey: "fileName",
        id: "fileName",
        header: ({ column }) => <DataGridColumnHeader title="File" column={column} />,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-3">
            <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium">{row.original.fileName}</span>
              {canManageDatasets && onRenameDataset ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-muted-foreground"
                  disabled={isBusy || isReplacingDataset || isRenamingDataset}
                  onClick={() => onRenameDataset(row.original)}
                >
                  <PencilIcon className="size-3.5" />
                  Rename
                </Button>
              ) : null}
            </div>
          </div>
        ),
        meta: { headerTitle: "File" },
        size: 360,
        enableSorting: true,
        enableHiding: false,
      },
      {
        accessorKey: "rowCount",
        id: "rowCount",
        header: ({ column }) => (
          <DataGridColumnHeader title="Rows" column={column} />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.rowCount.toLocaleString()}
          </span>
        ),
        meta: { headerTitle: "Rows" },
        size: 110,
        enableSorting: true,
      },
      {
        id: "columnCount",
        accessorFn: (row) => row.columns.length,
        header: ({ column }) => (
          <DataGridColumnHeader title="Columns" column={column} />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.columns.length}</span>
        ),
        meta: { headerTitle: "Columns" },
        size: 120,
        enableSorting: true,
      },
      {
        accessorKey: "createdAt",
        id: "createdAt",
        header: ({ column }) => (
          <DataGridColumnHeader title="Created" column={column} />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDate(row.original.createdAt)}
          </span>
        ),
        meta: { headerTitle: "Created" },
        size: 220,
        enableSorting: true,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <Link
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-7",
              )}
              href={`/dashboard/datasets/${row.original.id}`}
            >
              Open
            </Link>
            {canManageDatasets && onRequestReplace ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7"
                disabled={isBusy || isReplacingDataset || isRenamingDataset}
                onClick={() => onRequestReplace(row.original)}
              >
                Replace
              </Button>
            ) : null}
          </div>
        ),
        size: canManageDatasets ? 190 : 90,
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [
      canManageDatasets,
      isRenamingDataset,
      isReplacingDataset,
      isBusy,
      onRenameDataset,
      onRequestReplace,
    ],
  );

  // TanStack Table intentionally returns non-memoizable handlers owned by this component.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: datasets,
    columns,
    getRowId: (row) => row.id,
    state: {
      sorting,
      globalFilter: filter,
    },
    columnResizeMode: "onChange",
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    autoResetPageIndex: false,
    globalFilterFn: (row, _columnId, value) =>
      datasetMatchesSearch(row.original, value),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const filteredCount = table.getFilteredRowModel().rows.length;

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-medium">Datasets</h2>
          <p className="text-sm text-muted-foreground">
            Open a saved CSV to filter, sort, and scroll rows.
          </p>
        </div>
        <Badge variant="secondary">
          {filteredCount} of {datasets.length} saved
        </Badge>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block sm:w-80">
          <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            value={filter}
            placeholder="Filter datasets"
            onChange={(event) => setFilter(event.target.value)}
          />
        </label>
      </div>

      <DataGrid
        table={table}
        recordCount={datasets.length}
        emptyMessage={
          datasets.length === 0
            ? "Upload a CSV to create your first table."
            : "No datasets match your filter."
        }
        tableLayout={{
          columnsResizable: true,
          headerSticky: true,
        }}
        tableClassNames={{
          headerSticky: "sticky top-0 z-10 bg-muted/90 backdrop-blur-xs",
        }}
      >
        <DataGridContainer>
          <DataGridScrollArea>
            <DataGridTableVirtual />
          </DataGridScrollArea>
        </DataGridContainer>
      </DataGrid>
    </section>
  );
}
