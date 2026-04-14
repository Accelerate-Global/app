"use client";

import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";

import { DataGrid, DataGridContainer } from "@/components/reui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTableVirtual } from "@/components/reui/data-grid/data-grid-table-virtual";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import type { DatasetRowsResponse, DatasetSummary } from "@/lib/api-types";

const ROW_FETCH_PAGE_SIZE = 1000;
const ROW_HEIGHT_ESTIMATE = 37;
const ROW_OVERSCAN = 30;

type DatasetRow = DatasetRowsResponse["rows"][number];
type RowLoadPhase = "idle" | "starting" | "downloading" | "finished";

type DatasetTableProps = {
  dataset: DatasetSummary;
};

function getCellValue(row: DatasetRow, key: string) {
  return row.data[key] ?? "";
}

async function fetchRowsPage(input: {
  datasetId: string;
  page: number;
  signal: AbortSignal;
}) {
  const params = new URLSearchParams({
    page: String(input.page),
    pageSize: String(ROW_FETCH_PAGE_SIZE),
  });
  const response = await fetch(
    `/api/datasets/${input.datasetId}/rows?${params.toString()}`,
    {
      signal: input.signal,
    },
  );

  if (!response.ok) {
    throw new Error("Rows could not be loaded.");
  }

  return (await response.json()) as DatasetRowsResponse;
}

export function DatasetTable({ dataset }: DatasetTableProps) {
  const [rows, setRows] = useState<DatasetRow[]>([]);
  const [totalRows, setTotalRows] = useState(dataset.rowCount);
  const [downloadedRowCount, setDownloadedRowCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadPhase, setLoadPhase] = useState<RowLoadPhase>("starting");
  const [loadMessage, setLoadMessage] = useState("Loading rows");
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<DatasetRow>[]>(
    () => [
      {
        id: "rowIndex",
        accessorFn: (row) => row.rowIndex + 1,
        header: ({ column }) => (
          <DataGridColumnHeader title="#" column={column} />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">
            {row.original.rowIndex + 1}
          </span>
        ),
        meta: { headerTitle: "#" },
        size: 72,
        enableHiding: false,
        enableSorting: true,
      },
      ...dataset.columns.map(
        (column): ColumnDef<DatasetRow> => ({
          id: column.key,
          accessorFn: (row) => getCellValue(row, column.key),
          header: ({ column: tableColumn }) => (
            <DataGridColumnHeader title={column.label} column={tableColumn} />
          ),
          cell: ({ row }) => (
            <span className="block max-w-[28rem] truncate">
              {getCellValue(row.original, column.key)}
            </span>
          ),
          meta: { headerTitle: column.label },
          size: Math.min(Math.max(column.label.length * 12, 160), 280),
          enableSorting: true,
        }),
      ),
    ],
    [dataset.columns],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    state: {
      sorting,
    },
    initialState: {
      columnPinning: {
        left: ["rowIndex"],
      },
    },
    columnResizeMode: "onChange",
    onSortingChange: setSorting,
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const shownPeopleGroupCount = rows.length;
  const downloadProgress =
    totalRows > 0
      ? Math.min((downloadedRowCount / totalRows) * 100, 100)
      : loadPhase === "finished"
        ? 100
        : 0;
  const showDownloadStatus =
    !error &&
    (loadPhase === "starting" || loadPhase === "downloading");

  useEffect(() => {
    const controller = new AbortController();

    async function loadRows() {
      const nextRows: DatasetRow[] = [];
      let page = 1;
      let pageCount = 1;

      setRows([]);
      setTotalRows(dataset.rowCount);
      setDownloadedRowCount(0);
      setLoadPhase("starting");
      setLoadMessage("Starting download...");
      setIsLoading(true);
      setError(null);

      try {
        let resolvedTotalRows = dataset.rowCount;

        do {
          const payload = await fetchRowsPage({
            datasetId: dataset.id,
            page,
            signal: controller.signal,
          });

          nextRows.push(...payload.rows);
          pageCount = payload.pageCount;
          page += 1;
          resolvedTotalRows = payload.totalRows;

          setTotalRows(payload.totalRows);
          setDownloadedRowCount(nextRows.length);
          setLoadPhase("downloading");
          setLoadMessage(
            `Downloaded ${nextRows.length.toLocaleString()} of ${payload.totalRows.toLocaleString()} people groups`,
          );
        } while (page <= pageCount);

        if (!controller.signal.aborted) {
          setRows(nextRows);
          setTotalRows(resolvedTotalRows);
          setDownloadedRowCount(nextRows.length);
          setLoadPhase("finished");
          setLoadMessage(
            `Finished downloading ${nextRows.length.toLocaleString()} people groups`,
          );
        }
      } catch (fetchError) {
        if (
          fetchError instanceof DOMException &&
          fetchError.name === "AbortError"
        ) {
          return;
        }

        setLoadPhase("idle");
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Rows could not be loaded.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadRows();

    return () => controller.abort();
  }, [dataset.id, dataset.rowCount]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {shownPeopleGroupCount.toLocaleString()} people groups shown
        </span>
      </div>

      {dataset.error ? (
        <Alert variant="destructive">
          <AlertTitle>Dataset error</AlertTitle>
          <AlertDescription>{dataset.error}</AlertDescription>
        </Alert>
      ) : null}

      {showDownloadStatus ? (
        <div className="max-w-xl space-y-2">
          <Progress value={downloadProgress}>
            <ProgressLabel>Dataset download</ProgressLabel>
            <ProgressValue />
          </Progress>
          <p className="text-sm text-muted-foreground">{loadMessage}</p>
        </div>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Table error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <DataGrid
        table={table}
        recordCount={rows.length}
        isLoading={isLoading}
        emptyMessage={
          isLoading
            ? loadMessage
            : "No people groups found."
        }
        tableLayout={{
          columnsPinnable: true,
          columnsResizable: true,
          headerSticky: true,
        }}
        tableClassNames={{
          headerSticky: "sticky top-0 z-10 bg-muted/90 backdrop-blur-xs",
        }}
      >
        <DataGridContainer>
          <DataGridScrollArea className="h-[560px]">
            <DataGridTableVirtual
              estimateSize={ROW_HEIGHT_ESTIMATE}
              overscan={ROW_OVERSCAN}
            />
          </DataGridScrollArea>
        </DataGridContainer>
      </DataGrid>
    </div>
  );
}
