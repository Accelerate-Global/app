import type {
  DatasetRowsResponse,
  DatasetSummary,
  FieldDefinitionPresentation,
  SavedDatasetSort,
} from "@/lib/api-types";
import { getVisibleDatasetColumns } from "@/lib/dataset-column-visibility";

type DatasetRow = DatasetRowsResponse["rows"][number];

const PRIORITY_COLUMN_ALIAS_GROUPS = [
  ["pg_rop3", "rop3"],
  ["pg_name_main", "people_name", "pg_name", "people_group_name"],
  ["geo_country_name", "main_country_name"],
  ["alternate_countries", "countries", "alt_country_name"],
  ["christianity_gsec", "gsec", "gsec_status"],
  ["christianity_frontier_group", "frontier"],
] as const;

export function getDatasetCellValue(row: DatasetRow, key: string) {
  return row.data[key] ?? "";
}

export function getDatasetColumnDisplayLabel(
  column: DatasetSummary["columns"][number],
  fieldDefinitionPresentationByColumnKey: Record<string, FieldDefinitionPresentation>,
) {
  return fieldDefinitionPresentationByColumnKey[column.key]?.effectiveLabel ?? column.label;
}

function normalizeDatasetColumnIdentity(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function compareDatasetColumnsByLabel(
  left: DatasetSummary["columns"][number],
  right: DatasetSummary["columns"][number],
  fieldDefinitionPresentationByColumnKey: Record<string, FieldDefinitionPresentation>,
) {
  const leftLabel = getDatasetColumnDisplayLabel(
    left,
    fieldDefinitionPresentationByColumnKey,
  );
  const rightLabel = getDatasetColumnDisplayLabel(
    right,
    fieldDefinitionPresentationByColumnKey,
  );
  const labelComparison = leftLabel.localeCompare(rightLabel, undefined, {
    sensitivity: "base",
    numeric: true,
  });

  if (labelComparison !== 0) {
    return labelComparison;
  }

  return left.sourceIndex - right.sourceIndex;
}

function getPriorityColumnIndex(input: {
  column: DatasetSummary["columns"][number];
  fieldDefinitionPresentationByColumnKey: Record<string, FieldDefinitionPresentation>;
}) {
  const effectiveLabel = getDatasetColumnDisplayLabel(
    input.column,
    input.fieldDefinitionPresentationByColumnKey,
  );
  const identities = new Set(
    [input.column.key, input.column.label, effectiveLabel]
      .map((value) => normalizeDatasetColumnIdentity(value))
      .filter(Boolean),
  );

  return PRIORITY_COLUMN_ALIAS_GROUPS.findIndex((aliases) =>
    aliases.some((alias) => identities.has(alias)),
  );
}

export function getSortedVisibleDatasetColumns(input: {
  columns: DatasetSummary["columns"];
  hiddenColumnKeys: DatasetSummary["hiddenColumnKeys"];
  fieldDefinitionPresentationByColumnKey: Record<string, FieldDefinitionPresentation>;
}) {
  const prioritizedColumns = PRIORITY_COLUMN_ALIAS_GROUPS.map(
    () => [] as DatasetSummary["columns"],
  );
  const remainingColumns: DatasetSummary["columns"] = [];

  for (const column of getVisibleDatasetColumns(input.columns, input.hiddenColumnKeys)) {
    const priorityIndex = getPriorityColumnIndex({
      column,
      fieldDefinitionPresentationByColumnKey:
        input.fieldDefinitionPresentationByColumnKey,
    });

    if (priorityIndex >= 0) {
      prioritizedColumns[priorityIndex]?.push(column);
      continue;
    }

    remainingColumns.push(column);
  }

  return [
    ...prioritizedColumns.flatMap((columns) =>
      [...columns].sort((left, right) => left.sourceIndex - right.sourceIndex),
    ),
    ...remainingColumns.sort((left, right) =>
      compareDatasetColumnsByLabel(
        left,
        right,
        input.fieldDefinitionPresentationByColumnKey,
      ),
    ),
  ];
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
