"use client";

import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";

import { FieldDefinitionHeaderInfo } from "@/components/dashboard/field-definition-header-info";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import type {
  DatasetRowsResponse,
  DatasetSummary,
  FieldDefinitionPresentation,
} from "@/lib/api-types";
import {
  getDatasetCellValue,
  getDatasetColumnDisplayLabel,
  getSortedVisibleDatasetColumns,
} from "@/lib/dataset-table-columns";
import {
  filterDatasetRowsByRegion,
  filterDatasetRowsByUupg,
  filterDatasetRowsByWatchlist,
  type DatasetRegionFilterState,
  type DatasetUupgFilterState,
  type DatasetWatchlistFilterState,
} from "@/lib/dataset-region-filtering";

type DatasetRow = DatasetRowsResponse["rows"][number];

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

export function useDatasetTableState(input: {
  dataset: DatasetSummary;
  regionFilter?: DatasetRegionFilterState;
  watchlistFilter?: DatasetWatchlistFilterState;
  uupgFilter?: DatasetUupgFilterState;
  fieldDefinitionPresentationByColumnKey?: Record<
    string,
    FieldDefinitionPresentation
  >;
}) {
  const [rows, setRows] = useState<DatasetRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const fieldDefinitionPresentationByColumnKey = useMemo(
    () => input.fieldDefinitionPresentationByColumnKey ?? {},
    [input.fieldDefinitionPresentationByColumnKey],
  );

  const filteredRows = useMemo(
    () =>
      filterDatasetRowsByUupg(
        filterDatasetRowsByWatchlist(
          filterDatasetRowsByRegion(rows, input.regionFilter),
          input.watchlistFilter,
        ),
        input.uupgFilter,
      ),
    [rows, input.regionFilter, input.uupgFilter, input.watchlistFilter],
  );
  const visibleColumns = useMemo(
    () =>
      getSortedVisibleDatasetColumns({
        columns: input.dataset.columns,
        hiddenColumnKeys: input.dataset.hiddenColumnKeys,
        fieldDefinitionPresentationByColumnKey,
      }),
    [
      fieldDefinitionPresentationByColumnKey,
      input.dataset.columns,
      input.dataset.hiddenColumnKeys,
    ],
  );

  const columns = useMemo<ColumnDef<DatasetRow>[]>(
    () => [
      {
        id: "rowIndex",
        accessorFn: (row) => row.rowIndex + 1,
        header: () => <span className="sr-only">Row number</span>,
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">
            {row.original.rowIndex + 1}
          </span>
        ),
        meta: { headerTitle: "Row number" },
        size: 72,
        enableHiding: false,
        enableSorting: false,
      },
      ...visibleColumns.map(
        (column): ColumnDef<DatasetRow> => {
          const fieldDefinitionPresentation =
            fieldDefinitionPresentationByColumnKey[column.key];
          const columnLabel = getDatasetColumnDisplayLabel(
            column,
            fieldDefinitionPresentationByColumnKey,
          );

          return {
            id: column.key,
            accessorFn: (row) => getDatasetCellValue(row, column.key),
            header: ({ column: tableColumn }) => (
              <DataGridColumnHeader
                title={columnLabel}
                column={tableColumn}
                detail={
                  <FieldDefinitionHeaderInfo
                    label={columnLabel}
                    definition={fieldDefinitionPresentation?.definition ?? ""}
                    linkedSources={fieldDefinitionPresentation?.linkedSources ?? []}
                  />
                }
              />
            ),
            cell: ({ row }) => (
              <span className="block max-w-[28rem] truncate">
                {getDatasetCellValue(row.original, column.key)}
              </span>
            ),
            meta: { headerTitle: columnLabel },
            size: Math.min(Math.max(columnLabel.length * 12, 160), 280),
            enableSorting: true,
          };
        },
      ),
    ],
    [fieldDefinitionPresentationByColumnKey, visibleColumns],
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
          datasetId: input.dataset.id,
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
  }, [input.dataset.id, input.dataset.rowCount]);

  return {
    table,
    sorting,
    visibleColumns,
    sortedRows: table.getRowModel().rows.map((row) => row.original),
    recordCount: table.getRowModel().rows.length,
    isLoading,
    error,
  };
}
