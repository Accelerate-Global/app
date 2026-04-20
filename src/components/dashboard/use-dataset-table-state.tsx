"use client";

import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  ensureDatasetRowsCache,
  getDatasetRowsCacheSnapshot,
  subscribeToDatasetRowsCache,
} from "@/components/dashboard/dataset-row-cache";
import { FieldDefinitionHeaderInfo } from "@/components/dashboard/field-definition-header-info";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import type {
  DatasetRowsResponse,
  DatasetSummary,
  FieldDefinitionPresentation,
  SavedDatasetSort,
} from "@/lib/api-types";
import type { AppAnalyticsContext, DatasetOpenSource } from "@/lib/analytics";
import { withAnalyticsContext } from "@/lib/analytics";
import { trackAppEvent } from "@/lib/analytics-client";
import {
  getDatasetCellValue,
  getDatasetColumnDisplayLabel,
  getSortedVisibleDatasetColumns,
} from "@/lib/dataset-table-columns";
import {
  filterDatasetRowsByCountry,
  filterDatasetRowsByRegion,
  filterDatasetRowsByUupg,
  filterDatasetRowsByWatchlist,
  getAvailableDatasetCountryNames,
  type DatasetCountryFilterState,
  type DatasetRegionFilterState,
  type DatasetUupgFilterState,
  type DatasetWatchlistFilterState,
} from "@/lib/dataset-region-filtering";

type DatasetRow = DatasetRowsResponse["rows"][number];

export function useDatasetTableState(input: {
  dataset: DatasetSummary;
  initialSorting?: SavedDatasetSort[] | null;
  regionFilter?: DatasetRegionFilterState;
  countryFilter?: DatasetCountryFilterState;
  watchlistFilter?: DatasetWatchlistFilterState;
  uupgFilter?: DatasetUupgFilterState;
  fieldDefinitionPresentationByColumnKey?: Record<
    string,
    FieldDefinitionPresentation
  >;
  analytics?: {
    context: AppAnalyticsContext;
    datasetSource: DatasetOpenSource;
  };
}) {
  const sourceDatasetId = input.dataset.backingDatasetId ?? input.dataset.id;
  const [rows, setRows] = useState<DatasetRow[]>(
    () => getDatasetRowsCacheSnapshot(sourceDatasetId).rows,
  );
  const [isLoading, setIsLoading] = useState(
    () => {
      const status = getDatasetRowsCacheSnapshot(sourceDatasetId).status;
      return status === "idle" || status === "loading";
    },
  );
  const [error, setError] = useState<string | null>(
    () => getDatasetRowsCacheSnapshot(sourceDatasetId).error,
  );
  const [sorting, setSorting] = useState<SortingState>(
    () => input.initialSorting ?? [],
  );
  const cacheLoadStartTimeRef = useRef<number>(Date.now());
  const hasTrackedRowsLoadedRef = useRef(false);
  const hasTrackedRowsFailedRef = useRef(false);
  const fieldDefinitionPresentationByColumnKey = useMemo(
    () => input.fieldDefinitionPresentationByColumnKey ?? {},
    [input.fieldDefinitionPresentationByColumnKey],
  );

  const rowsBeforeCountryFilter = useMemo(
    () =>
      filterDatasetRowsByUupg(
        filterDatasetRowsByWatchlist(
          filterDatasetRowsByRegion(rows, input.regionFilter),
          input.watchlistFilter,
        ),
        input.uupgFilter,
      ),
    [
      rows,
      input.regionFilter,
      input.uupgFilter,
      input.watchlistFilter,
    ],
  );
  const filteredRows = useMemo(
    () => filterDatasetRowsByCountry(rowsBeforeCountryFilter, input.countryFilter),
    [rowsBeforeCountryFilter, input.countryFilter],
  );
  const datasetCountryNames = useMemo(
    () =>
      getAvailableDatasetCountryNames(rows, {
        includeAlternateCountries:
          input.countryFilter?.includeAlternateCountries ?? false,
      }),
    [input.countryFilter?.includeAlternateCountries, rows],
  );
  const availableCountryNames = useMemo(
    () =>
      getAvailableDatasetCountryNames(rowsBeforeCountryFilter, {
        includeAlternateCountries:
          input.countryFilter?.includeAlternateCountries ?? false,
      }),
    [input.countryFilter?.includeAlternateCountries, rowsBeforeCountryFilter],
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

  // eslint-disable-next-line react-hooks/incompatible-library
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
    hasTrackedRowsLoadedRef.current = false;
    hasTrackedRowsFailedRef.current = false;
    cacheLoadStartTimeRef.current = Date.now();

    const initialSnapshot = getDatasetRowsCacheSnapshot(sourceDatasetId);
    setRows(initialSnapshot.rows);
    setIsLoading(
      initialSnapshot.status === "idle" || initialSnapshot.status === "loading",
    );
    setError(initialSnapshot.error);

    if (input.analytics) {
      const { datasetSource, context } = input.analytics;
      const isCacheHit =
        initialSnapshot.status === "ready" || initialSnapshot.status === "loading";

      trackAppEvent(
        isCacheHit ? "dataset_row_cache_hit" : "dataset_row_cache_miss",
        withAnalyticsContext(context, {
          source_surface: "dataset_table",
          success: true,
          dataset_id: input.dataset.id,
          dataset_source: datasetSource,
          source_dataset_id: sourceDatasetId,
          cached_row_count: initialSnapshot.rows.length,
        }),
      );
    }

    const unsubscribe = subscribeToDatasetRowsCache(sourceDatasetId, (snapshot) => {
      setRows(snapshot.rows);
      setIsLoading(snapshot.status === "idle" || snapshot.status === "loading");
      setError(snapshot.error);

      if (!input.analytics) {
        return;
      }

      const { datasetSource, context } = input.analytics;
      const durationMs = Date.now() - cacheLoadStartTimeRef.current;

      if (snapshot.isReady && !hasTrackedRowsLoadedRef.current) {
        hasTrackedRowsLoadedRef.current = true;
        trackAppEvent(
          "dataset_rows_loaded",
          withAnalyticsContext(context, {
            source_surface: "dataset_table",
            success: true,
            dataset_id: input.dataset.id,
            dataset_source: datasetSource,
            row_count: snapshot.rows.length,
            load_duration_ms: durationMs,
            duration_ms: durationMs,
          }),
        );
      }

      if (snapshot.status === "error" && !hasTrackedRowsFailedRef.current) {
        hasTrackedRowsFailedRef.current = true;
        trackAppEvent(
          "dataset_rows_failed",
          withAnalyticsContext(context, {
            source_surface: "dataset_table",
            success: false,
            error_code: "dataset_rows_failed",
            dataset_id: input.dataset.id,
            dataset_source: datasetSource,
            duration_ms: durationMs,
          }),
        );
      }
    });

    void ensureDatasetRowsCache({
      datasetId: input.dataset.id,
      sourceDatasetId,
    }).promise;

    return unsubscribe;
  }, [input.analytics, input.dataset.id, sourceDatasetId]);

  return {
    table,
    sorting,
    visibleColumns,
    datasetCountryNames,
    availableCountryNames,
    sortedRows: table.getRowModel().rows.map((row) => row.original),
    recordCount: table.getRowModel().rows.length,
    isLoading,
    error,
  };
}
