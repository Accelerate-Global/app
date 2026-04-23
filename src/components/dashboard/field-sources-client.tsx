"use client";

import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { DataGrid, DataGridContainer } from "@/components/reui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import type { FieldSourceGridRow, FieldSourceType } from "@/lib/api-types";

type FieldSourcesClientProps = {
  initialFieldSourceTypes: FieldSourceType[];
  initialFieldSources: FieldSourceGridRow[];
};

function sortFieldSources(fieldSources: FieldSourceGridRow[]) {
  return [...fieldSources].sort((left, right) =>
    left.effectiveLabel.localeCompare(right.effectiveLabel, undefined, {
      sensitivity: "base",
    }),
  );
}

function getSourceColumnWidth(label: string) {
  return Math.min(Math.max(label.length * 12, 160), 280);
}

function FieldSourceValueCell({
  fieldDefinitionId,
  sourceTypeId,
  value,
}: {
  fieldDefinitionId: string;
  sourceTypeId: string;
  value: string;
}) {
  const trimmedValue = value.trim();

  return (
    <div
      className="min-w-[10rem]"
      data-smoke-field-source-value={`${fieldDefinitionId}:${sourceTypeId}`}
    >
      <div className="rounded-md border border-input bg-background px-3 py-2 text-sm leading-5">
        {trimmedValue ? (
          <span className="text-foreground">{trimmedValue}</span>
        ) : (
          <span className="text-muted-foreground">Not tracked</span>
        )}
      </div>
    </div>
  );
}

function FieldSourcesEmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
      No field definitions are available yet.
    </div>
  );
}

export function FieldSourcesClient({
  initialFieldSourceTypes,
  initialFieldSources,
}: FieldSourcesClientProps) {
  const fieldSources = useMemo(
    () => sortFieldSources(initialFieldSources),
    [initialFieldSources],
  );
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "effectiveLabel",
      desc: false,
    },
  ]);

  const columns = useMemo<ColumnDef<FieldSourceGridRow>[]>(
    () => [
      {
        id: "effectiveLabel",
        accessorFn: (row) => row.effectiveLabel,
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Field"
            column={column}
            renderStateKey={`${column.getIsSorted()}:${column.getIsPinned()}`}
          />
        ),
        cell: ({ row }) => (
          <p className="min-w-[14rem] font-medium text-foreground">
            {row.original.effectiveLabel}
          </p>
        ),
        meta: { headerTitle: "Field" },
        size: 220,
        enableSorting: true,
        enableHiding: false,
      },
      ...initialFieldSourceTypes.map(
        (fieldSourceType): ColumnDef<FieldSourceGridRow> => ({
          id: `source:${fieldSourceType.id}`,
          accessorFn: (row) => row.sourceValues[fieldSourceType.id] ?? "",
          header: ({ column }) => (
            <div data-smoke-field-source-column={fieldSourceType.label}>
              <DataGridColumnHeader
                title={fieldSourceType.label}
                column={column}
                renderStateKey={`${column.getIsSorted()}:${column.getIsPinned()}`}
              />
            </div>
          ),
          cell: ({ row }) => (
            <FieldSourceValueCell
              fieldDefinitionId={row.original.fieldDefinitionId}
              sourceTypeId={fieldSourceType.id}
              value={row.original.sourceValues[fieldSourceType.id] ?? ""}
            />
          ),
          meta: { headerTitle: fieldSourceType.label },
          size: getSourceColumnWidth(fieldSourceType.label),
          enableSorting: false,
        }),
      ),
    ],
    [initialFieldSourceTypes],
  );

  const table = useReactTable({
    data: fieldSources,
    columns,
    getRowId: (row) => row.fieldDefinitionId,
    state: {
      sorting,
    },
    initialState: {
      columnPinning: {
        left: ["effectiveLabel"],
      },
    },
    columnResizeMode: "onChange",
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const hasFieldSources = fieldSources.length > 0;

  return hasFieldSources ? (
    <DataGrid
      table={table}
      recordCount={fieldSources.length}
      tableLayout={{
        columnsPinnable: true,
        columnsResizable: true,
        headerSticky: true,
      }}
      tableClassNames={{
        headerSticky: "sticky top-0 z-10 bg-muted/90 backdrop-blur-xs",
        bodyRow: "[&>td]:align-top [&>td]:py-2.5",
      }}
    >
      <DataGridContainer>
        <DataGridScrollArea className="h-[560px]">
          <DataGridTable />
        </DataGridScrollArea>
      </DataGridContainer>
    </DataGrid>
  ) : (
    <FieldSourcesEmptyState />
  );
}
