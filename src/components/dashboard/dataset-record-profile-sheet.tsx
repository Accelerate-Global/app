"use client";

import { useMemo } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  DatasetRowsResponse,
  DatasetSummary,
  FieldDefinitionPresentation,
} from "@/lib/api-types";
import {
  formatDatasetCellValueForDisplay,
  getDatasetCellValue,
  getDatasetColumnDisplayLabel,
} from "@/lib/dataset-table-columns";

type DatasetRow = DatasetRowsResponse["rows"][number];

type DatasetRecordProfileSheetProps = {
  open: boolean;
  row: DatasetRow | null;
  visibleColumns: DatasetSummary["columns"];
  fieldDefinitionPresentationByColumnKey: Record<
    string,
    FieldDefinitionPresentation
  >;
  onOpenChange: (open: boolean) => void;
};

const PEOPLE_GROUP_NAME_IDENTITIES = new Set([
  "pg_name_main",
  "people_name",
  "pg_name",
  "people_group_name",
  "people_group_name_text",
  "peopnameacrosscountries",
]);

function normalizeColumnIdentity(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function getRecordTitle(
  row: DatasetRow,
  visibleColumns: DatasetSummary["columns"],
) {
  for (const column of visibleColumns) {
    if (
      !PEOPLE_GROUP_NAME_IDENTITIES.has(normalizeColumnIdentity(column.key)) &&
      !PEOPLE_GROUP_NAME_IDENTITIES.has(normalizeColumnIdentity(column.label))
    ) {
      continue;
    }

    const value = getDatasetCellValue(row, column.key).trim();
    if (value) {
      return value;
    }
  }

  return `Record ${row.rowIndex + 1}`;
}

export function DatasetRecordProfileSheet({
  open,
  row,
  visibleColumns,
  fieldDefinitionPresentationByColumnKey,
  onOpenChange,
}: DatasetRecordProfileSheetProps) {
  const fields = useMemo(
    () =>
      row
        ? visibleColumns.map((column) => {
            const label = getDatasetColumnDisplayLabel(
              column,
              fieldDefinitionPresentationByColumnKey,
            );
            return {
              key: column.key,
              label,
              value: formatDatasetCellValueForDisplay({
                value: getDatasetCellValue(row, column.key),
                column,
                effectiveLabel: label,
              }),
            };
          })
        : [],
    [fieldDefinitionPresentationByColumnKey, row, visibleColumns],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full border-border bg-background p-0 sm:max-w-lg"
        data-smoke-surface="dataset-record-profile-sheet"
        data-smoke-ready="dataset-record-profile-sheet"
      >
        <SheetHeader className="border-b border-border px-5 py-5 pr-14">
          <SheetTitle>{row ? getRecordTitle(row, visibleColumns) : "People Group record"}</SheetTitle>
          <SheetDescription>
            {row
              ? `Read-only dataset profile · source row ${(row.rowIndex + 1).toLocaleString()}`
              : "Read-only dataset profile"}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
          {row ? (
            <dl className="divide-y divide-border">
              {fields.map((field) => (
                <div
                  key={field.key}
                  className="grid gap-1 py-3 sm:grid-cols-[minmax(8rem,0.8fr)_minmax(0,1.2fr)] sm:gap-4"
                >
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {field.label}
                  </dt>
                  <dd className="break-words text-sm text-foreground">
                    {field.value || <span className="text-muted-foreground">—</span>}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
