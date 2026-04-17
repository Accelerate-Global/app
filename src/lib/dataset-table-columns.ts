import type {
  DatasetRowsResponse,
  DatasetSummary,
  FieldDefinitionPresentation,
  SavedDatasetSort,
} from "@/lib/api-types";
import { getVisibleDatasetColumns } from "@/lib/dataset-column-visibility";

type DatasetRow = DatasetRowsResponse["rows"][number];

export function getDatasetCellValue(row: DatasetRow, key: string) {
  return row.data[key] ?? "";
}

export function getDatasetColumnDisplayLabel(
  column: DatasetSummary["columns"][number],
  fieldDefinitionPresentationByColumnKey: Record<string, FieldDefinitionPresentation>,
) {
  return fieldDefinitionPresentationByColumnKey[column.key]?.effectiveLabel ?? column.label;
}

export function getSortedVisibleDatasetColumns(input: {
  columns: DatasetSummary["columns"];
  hiddenColumnKeys: DatasetSummary["hiddenColumnKeys"];
  fieldDefinitionPresentationByColumnKey: Record<string, FieldDefinitionPresentation>;
}) {
  return [...getVisibleDatasetColumns(input.columns, input.hiddenColumnKeys)].sort(
    (left, right) => {
      const leftLabel = getDatasetColumnDisplayLabel(
        left,
        input.fieldDefinitionPresentationByColumnKey,
      );
      const rightLabel = getDatasetColumnDisplayLabel(
        right,
        input.fieldDefinitionPresentationByColumnKey,
      );
      const labelComparison = leftLabel.localeCompare(rightLabel, undefined, {
        sensitivity: "base",
        numeric: true,
      });

      if (labelComparison !== 0) {
        return labelComparison;
      }

      return left.sourceIndex - right.sourceIndex;
    },
  );
}

function compareDatasetCellValues(left: string, right: string) {
  return left.localeCompare(right, undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

export function sortDatasetRows(
  rows: DatasetRow[],
  sorting: SavedDatasetSort[],
) {
  if (sorting.length === 0) {
    return [...rows].sort((left, right) => left.rowIndex - right.rowIndex);
  }

  return [...rows].sort((left, right) => {
    for (const sort of sorting) {
      const comparison = compareDatasetCellValues(
        getDatasetCellValue(left, sort.id),
        getDatasetCellValue(right, sort.id),
      );

      if (comparison !== 0) {
        return sort.desc ? -comparison : comparison;
      }
    }

    return left.rowIndex - right.rowIndex;
  });
}
