import type {
  DatasetRowsResponse,
  DatasetSummary,
  FieldDefinitionPresentation,
} from "@/lib/api-types";
import { escapeCsvCell, sanitizeFileName } from "@/lib/csv";
import {
  getDatasetCellValue,
  getDatasetColumnDisplayLabel,
} from "@/lib/dataset-table-columns";

type DatasetRow = DatasetRowsResponse["rows"][number];

function stripCsvExtension(value: string) {
  return value.trim().replace(/\.csv$/iu, "");
}

export function serializeDatasetRowsToCsv(input: {
  rows: DatasetRow[];
  visibleColumns: DatasetSummary["columns"];
  fieldDefinitionPresentationByColumnKey: Record<string, FieldDefinitionPresentation>;
}) {
  const headers = [
    "Row number",
    ...input.visibleColumns.map((column) =>
      getDatasetColumnDisplayLabel(
        column,
        input.fieldDefinitionPresentationByColumnKey,
      ),
    ),
  ];
  const lines = [headers.map(escapeCsvCell).join(",")];

  for (const row of input.rows) {
    lines.push(
      [
        String(row.rowIndex + 1),
        ...input.visibleColumns.map((column) =>
          getDatasetCellValue(row, column.key),
        ),
      ]
        .map((value) => escapeCsvCell(String(value)))
        .join(","),
    );
  }

  return `${lines.join("\r\n")}\r\n`;
}

export function getFilteredDatasetDownloadFileName(fileName: string) {
  const sanitizedBaseName = sanitizeFileName(stripCsvExtension(fileName));
  return `${sanitizedBaseName || "dataset"}-filtered.csv`;
}

export function getSavedDatasetDownloadFileName(name: string) {
  const sanitizedBaseName = sanitizeFileName(stripCsvExtension(name));
  return `${sanitizedBaseName || "saved-table"}.csv`;
}
