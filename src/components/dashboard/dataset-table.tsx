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
import { FieldDefinitionHeaderInfo } from "@/components/dashboard/field-definition-header-info";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type {
  DatasetRowsResponse,
  DatasetSummary,
  FieldDefinitionPresentation,
} from "@/lib/api-types";
import { getVisibleDatasetColumns } from "@/lib/dataset-column-visibility";
import {
  filterDatasetRowsByRegion,
  filterDatasetRowsByWatchlist,
  filterDatasetRowsByUupg,
  type DatasetRegionFilterState,
  type DatasetWatchlistFilterState,
  type DatasetUupgFilterState,
} from "@/lib/dataset-region-filtering";

const ROW_HEIGHT_ESTIMATE = 40;
const ROW_OVERSCAN = 60;

type DatasetRow = DatasetRowsResponse["rows"][number];

type DatasetTableProps = {
  dataset: DatasetSummary;
  regionFilter?: DatasetRegionFilterState;
  watchlistFilter?: DatasetWatchlistFilterState;
  uupgFilter?: DatasetUupgFilterState;
  fieldDefinitionPresentationByColumnKey?: Record<
    string,
    FieldDefinitionPresentation
  >;
};

function getCellValue(row: DatasetRow, key: string) {
  return row.data[key] ?? "";
}

async function fetchAllRows(input: {
  datasetId: string;
  signal: AbortSignal;
}) {
  const params = new URLSearchParams({
    all: "true",
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

export function DatasetTable({
  dataset,
  regionFilter,
  watchlistFilter,
  uupgFilter,
  fieldDefinitionPresentationByColumnKey = {},
}: DatasetTableProps) {
  const [rows, setRows] = useState<DatasetRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const loadMessage = "Loading people groups...";
  const filteredRows = useMemo(
    () =>
      filterDatasetRowsByUupg(
        filterDatasetRowsByWatchlist(
          filterDatasetRowsByRegion(rows, regionFilter),
          watchlistFilter,
        ),
        uupgFilter,
      ),
    [rows, regionFilter, watchlistFilter, uupgFilter],
  );

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
      ...getVisibleDatasetColumns(
        dataset.columns,
        dataset.hiddenColumnKeys,
      ).map(
        (column): ColumnDef<DatasetRow> => {
          const fieldDefinitionPresentation =
            fieldDefinitionPresentationByColumnKey[column.key];
          const columnLabel =
            fieldDefinitionPresentation?.effectiveLabel ?? column.label;

          return {
            id: column.key,
            accessorFn: (row) => getCellValue(row, column.key),
            header: ({ column: tableColumn }) => (
              <DataGridColumnHeader
                title={columnLabel}
                column={tableColumn}
                detail={
                  <FieldDefinitionHeaderInfo
                    label={columnLabel}
                    definition={fieldDefinitionPresentation?.definition ?? ""}
                  />
                }
              />
            ),
            cell: ({ row }) => (
              <span className="block max-w-[28rem] truncate">
                {getCellValue(row.original, column.key)}
              </span>
            ),
            meta: { headerTitle: columnLabel },
            size: Math.min(Math.max(columnLabel.length * 12, 160), 280),
            enableSorting: true,
          };
        },
      ),
    ],
    [
      dataset.columns,
      dataset.hiddenColumnKeys,
      fieldDefinitionPresentationByColumnKey,
    ],
  );

  const table = useReactTable({
    data: filteredRows,
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

  useEffect(() => {
    const controller = new AbortController();

    async function loadRows() {
      setRows([]);
      setIsLoading(true);
      setError(null);

      try {
        const payload = await fetchAllRows({
          datasetId: dataset.id,
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setRows(payload.rows);
        }
      } catch (fetchError) {
        if (
          fetchError instanceof DOMException &&
          fetchError.name === "AbortError"
        ) {
          return;
        }

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
      {dataset.error ? (
        <Alert variant="destructive">
          <AlertTitle>Dataset error</AlertTitle>
          <AlertDescription>{dataset.error}</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Table error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <DataGrid
        table={table}
        recordCount={filteredRows.length}
        isLoading={isLoading}
        loadingMessage={loadMessage}
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
          bodyRow: "[&>td]:h-10 [&>td]:py-0",
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
