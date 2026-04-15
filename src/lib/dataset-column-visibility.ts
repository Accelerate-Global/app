import type { CsvColumn } from "@/lib/api-types";

export function normalizeDatasetHiddenColumnKeys(
  hiddenColumnKeys: string[] | null | undefined,
  columns: Pick<CsvColumn, "key">[],
) {
  if (!hiddenColumnKeys?.length) {
    return [];
  }

  const requestedKeys = new Set(
    hiddenColumnKeys.map((key) => key.trim()).filter((key) => key.length > 0),
  );

  return columns
    .map((column) => column.key)
    .filter((key) => requestedKeys.has(key));
}

export function getVisibleDatasetColumns(
  columns: CsvColumn[],
  hiddenColumnKeys: string[] | null | undefined,
) {
  const hiddenKeys = new Set(hiddenColumnKeys ?? []);

  return columns.filter((column) => !hiddenKeys.has(column.key));
}
