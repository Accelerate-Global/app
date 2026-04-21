"use client";

import {
  type Table,
} from "@tanstack/react-table";

import { DataGrid, DataGridContainer } from "@/components/reui/data-grid/data-grid";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTableVirtual } from "@/components/reui/data-grid/data-grid-table-virtual";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { DatasetRowsResponse } from "@/lib/api-types";
import { useDatasetPerfRenderTrace } from "@/lib/render-trace";

const ROW_HEIGHT_ESTIMATE = 40;
const ROW_OVERSCAN = 10;
const DATA_GRID_LAYOUT = {
  columnsPinnable: true,
  columnsResizable: true,
  headerSticky: true,
} as const;
const DATA_GRID_CLASS_NAMES = {
  headerSticky: "sticky top-0 z-10 bg-muted/90 backdrop-blur-xs",
  bodyRow: "[&>td]:h-10 [&>td]:py-0",
} as const;

type DatasetRow = DatasetRowsResponse["rows"][number];

type DatasetTableProps = {
  table: Table<DatasetRow>;
  recordCount: number;
  isLoading: boolean;
  datasetError?: string | null;
  error?: string | null;
};

export function DatasetTable({
  table,
  recordCount,
  isLoading,
  datasetError,
  error,
}: DatasetTableProps) {
  useDatasetPerfRenderTrace("DatasetTable");
  const loadMessage = "Loading people groups...";

  return (
    <div className="space-y-4">
      {datasetError ? (
        <Alert variant="destructive">
          <AlertTitle>Dataset error</AlertTitle>
          <AlertDescription>{datasetError}</AlertDescription>
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
        recordCount={recordCount}
        isLoading={isLoading}
        loadingMessage={loadMessage}
        emptyMessage={
          isLoading
            ? loadMessage
            : "No people groups found."
        }
        tableLayout={DATA_GRID_LAYOUT}
        tableClassNames={DATA_GRID_CLASS_NAMES}
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
