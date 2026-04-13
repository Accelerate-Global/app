"use client";

import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { FileTextIcon, SearchIcon, Settings2Icon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { DataGrid, DataGridContainer } from "@/components/reui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import { DataGridColumnVisibility } from "@/components/reui/data-grid/data-grid-column-visibility";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTableVirtual } from "@/components/reui/data-grid/data-grid-table-virtual";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DatasetSummary } from "@/lib/api-types";
import { cn } from "@/lib/utils";

type DatasetsGridProps = {
  datasets: DatasetSummary[];
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusVariant(status: DatasetSummary["status"]) {
  if (status === "ready") return "default";
  if (status === "failed") return "destructive";
  return "secondary";
}

function datasetMatchesSearch(dataset: DatasetSummary, value: unknown) {
  const query = String(value ?? "").trim().toLowerCase();

  if (!query) return true;

  return [
    dataset.fileName,
    dataset.status,
    String(dataset.rowCount),
    String(dataset.columns.length),
    formatBytes(dataset.sizeBytes),
    formatDate(dataset.createdAt),
  ].some((item) => item.toLowerCase().includes(query));
}

export function DatasetsGrid({ datasets }: DatasetsGridProps) {
  const [filter, setFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const columns = useMemo<ColumnDef<DatasetSummary>[]>(
    () => [
      {
        accessorKey: "fileName",
        id: "fileName",
        header: ({ column }) => (
          <DataGridColumnHeader title="File" column={column} visibility />
        ),
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-3">
            <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{row.original.fileName}</span>
          </div>
        ),
        meta: { headerTitle: "File" },
        size: 320,
        enableSorting: true,
        enableHiding: false,
      },
      {
        accessorKey: "status",
        id: "status",
        header: ({ column }) => (
          <DataGridColumnHeader title="Status" column={column} />
        ),
        cell: ({ row }) => (
          <Badge variant={statusVariant(row.original.status)}>
            {row.original.status}
          </Badge>
        ),
        meta: { headerTitle: "Status" },
        size: 120,
        enableSorting: true,
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
        accessorKey: "sizeBytes",
        id: "sizeBytes",
        header: ({ column }) => (
          <DataGridColumnHeader title="Size" column={column} />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{formatBytes(row.original.sizeBytes)}</span>
        ),
        meta: { headerTitle: "Size" },
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
          <Link
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-7",
            )}
            href={`/dashboard/datasets/${row.original.id}`}
          >
            Open
          </Link>
        ),
        size: 90,
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [],
  );

  // TanStack Table intentionally returns non-memoizable handlers owned by this component.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: datasets,
    columns,
    getRowId: (row) => row.id,
    state: {
      sorting,
      columnVisibility,
      globalFilter: filter,
    },
    columnResizeMode: "onChange",
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
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

        <DataGridColumnVisibility
          table={table}
          trigger={
            <Button variant="outline" size="sm">
              <Settings2Icon />
              Columns
            </Button>
          }
        />
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
          columnsVisibility: true,
          headerSticky: true,
        }}
        tableClassNames={{
          headerSticky: "sticky top-0 z-10 bg-muted/90 backdrop-blur-xs",
        }}
      >
        <DataGridContainer>
          <DataGridScrollArea className="h-[420px]">
            <DataGridTableVirtual estimateSize={52} />
          </DataGridScrollArea>
        </DataGridContainer>
      </DataGrid>
    </section>
  );
}
