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
  base: "bg-card/95",
  headerSticky: "sticky top-0 z-10 bg-card/95 backdrop-blur-xs",
  headerRow: "bg-muted/30 [&>th[data-pinned]]:bg-card/95",
  body: "bg-card/95",
  bodyRow:
    "bg-card/95 [&>td]:h-10 [&>td]:py-0 [&>td[data-pinned]]:bg-card/95 [&:hover>td[data-pinned]]:bg-muted/40",
} as const;

type DatasetRow = DatasetRowsResponse["rows"][number];

type DatasetTableProps = {
  table: Table<DatasetRow>;
  recordCount: number;
  isLoading: boolean;
  datasetError?: string | null;
  error?: string | null;
  onRowClick?: (row: DatasetRow) => void;
};

export function DatasetTable({
  table,
  recordCount,
  isLoading,
  datasetError,
  error,
  onRowClick,
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
        onRowClick={onRowClick}
        emptyMessage={
          isLoading
            ? loadMessage
            : "No people groups found."
        }
        tableLayout={DATA_GRID_LAYOUT}
        tableClassNames={DATA_GRID_CLASS_NAMES}
      >
        <DataGridContainer className="bg-card/95">
          <DataGridScrollArea
            className="h-[560px] bg-card/95 xl:h-[760px]"
            data-smoke-dataset-table-viewport
          >
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
