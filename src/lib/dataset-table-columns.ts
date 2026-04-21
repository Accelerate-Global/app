import type { SortingFn } from "@tanstack/react-table";

import type {
  DatasetRowsResponse,
  DatasetSummary,
  FieldDefinitionPresentation,
  SavedDatasetSort,
} from "@/lib/api-types";
import { getVisibleDatasetColumns } from "@/lib/dataset-column-visibility";

type DatasetRow = DatasetRowsResponse["rows"][number];
export type DatasetColumnSortMode = "text" | "alphanumeric";

const TEXT_SORT_SAMPLE_OFFSET = 10;
const RE_SPLIT_ALPHA_NUMERIC = /([0-9]+)/gm;

type DatasetSortValue = {
  normalized: string;
  hasNumericToken: boolean;
  tokens: string[] | null;
};

type DatasetSortTraceBucket = {
  modeDetectionCount: number;
  modeDetectionDurationMs: number;
  detectedTextCount: number;
  detectedAlphanumericCount: number;
  compareCount: number;
  compareDurationMs: number;
  textCompareCount: number;
  textCompareDurationMs: number;
  alphanumericCompareCount: number;
  alphanumericCompareDurationMs: number;
  keyBuildCount: number;
  keyBuildDurationMs: number;
  tokenBuildCount: number;
  tokenBuildDurationMs: number;
};

type DatasetSortTraceState = {
  enabled: boolean;
  columns: Record<string, DatasetSortTraceBucket>;
};

type DatasetSortTraceGlobal = typeof globalThis & {
  __datasetDetailPerfSortTrace?: DatasetSortTraceState;
};

const PRIORITY_COLUMN_ALIAS_GROUPS = [
  ["pg_rop3", "rop3"],
  ["pg_name_main", "people_name", "pg_name", "people_group_name"],
  ["geo_country_name", "main_country_name"],
  ["alternate_countries", "countries", "alt_country_name"],
  ["christianity_gsec", "gsec", "gsec_status"],
  ["christianity_frontier_group", "frontier"],
] as const;

const datasetSortValueCache = new WeakMap<DatasetRow, Map<string, DatasetSortValue>>();
const datasetColumnSortModeCache = new WeakMap<
  DatasetRow[],
  Map<string, DatasetColumnSortMode>
>();

function getSortTimer() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance;
  }

  return {
    now: () => Date.now(),
  };
}

function getDatasetSortTraceBucket(columnId: string) {
  const traceState = (globalThis as DatasetSortTraceGlobal).__datasetDetailPerfSortTrace;

  if (!traceState?.enabled) {
    return null;
  }

  const existingBucket = traceState.columns[columnId];

  if (existingBucket) {
    return existingBucket;
  }

  const nextBucket: DatasetSortTraceBucket = {
    modeDetectionCount: 0,
    modeDetectionDurationMs: 0,
    detectedTextCount: 0,
    detectedAlphanumericCount: 0,
    compareCount: 0,
    compareDurationMs: 0,
    textCompareCount: 0,
    textCompareDurationMs: 0,
    alphanumericCompareCount: 0,
    alphanumericCompareDurationMs: 0,
    keyBuildCount: 0,
    keyBuildDurationMs: 0,
    tokenBuildCount: 0,
    tokenBuildDurationMs: 0,
  };

  traceState.columns[columnId] = nextBucket;
  return nextBucket;
}

function getCachedDatasetSortValue(row: DatasetRow, columnId: string) {
  let rowCache = datasetSortValueCache.get(row);

  if (!rowCache) {
    rowCache = new Map();
    datasetSortValueCache.set(row, rowCache);
  }

  const cachedValue = rowCache.get(columnId);

  if (cachedValue) {
    return cachedValue;
  }

  const timer = getSortTimer();
  const startedAt = timer.now();
  const rawValue = getDatasetCellValue(row, columnId);
  const normalized = rawValue.toLowerCase();
  const hasNumericToken = RE_SPLIT_ALPHA_NUMERIC.test(normalized);
  RE_SPLIT_ALPHA_NUMERIC.lastIndex = 0;
  const nextValue: DatasetSortValue = {
    normalized,
    hasNumericToken,
    tokens: null,
  };

  rowCache.set(columnId, nextValue);

  const traceBucket = getDatasetSortTraceBucket(columnId);

  if (traceBucket) {
    traceBucket.keyBuildCount += 1;
    traceBucket.keyBuildDurationMs += timer.now() - startedAt;
  }

  return nextValue;
}

function getDatasetSortTokens(row: DatasetRow, columnId: string) {
  const cachedValue = getCachedDatasetSortValue(row, columnId);

  if (cachedValue.tokens) {
    return cachedValue.tokens;
  }

  const timer = getSortTimer();
  const startedAt = timer.now();
  cachedValue.tokens = cachedValue.normalized
    .split(RE_SPLIT_ALPHA_NUMERIC)
    .filter(Boolean);
  RE_SPLIT_ALPHA_NUMERIC.lastIndex = 0;

  const traceBucket = getDatasetSortTraceBucket(columnId);

  if (traceBucket) {
    traceBucket.tokenBuildCount += 1;
    traceBucket.tokenBuildDurationMs += timer.now() - startedAt;
  }

  return cachedValue.tokens;
}

function compareBasicValues(left: string, right: string) {
  if (left > right) {
    return 1;
  }

  if (left < right) {
    return -1;
  }

  return 0;
}

function compareDatasetAlphanumericValues(
  left: DatasetRow,
  right: DatasetRow,
  columnId: string,
) {
  const leftValue = getCachedDatasetSortValue(left, columnId);
  const rightValue = getCachedDatasetSortValue(right, columnId);

  if (!leftValue.hasNumericToken && !rightValue.hasNumericToken) {
    return compareBasicValues(leftValue.normalized, rightValue.normalized);
  }

  const leftTokens = getDatasetSortTokens(left, columnId);
  const rightTokens = getDatasetSortTokens(right, columnId);
  const maxIndex = Math.min(leftTokens.length, rightTokens.length);

  for (let index = 0; index < maxIndex; index += 1) {
    const leftToken = leftTokens[index];
    const rightToken = rightTokens[index];

    if (leftToken === rightToken) {
      continue;
    }

    if (leftToken == null || rightToken == null) {
      break;
    }

    const leftNumber = Number.parseInt(leftToken, 10);
    const rightNumber = Number.parseInt(rightToken, 10);
    const leftIsNumber = !Number.isNaN(leftNumber);
    const rightIsNumber = !Number.isNaN(rightNumber);

    if (!leftIsNumber && !rightIsNumber) {
      return compareBasicValues(leftToken, rightToken);
    }

    if (leftIsNumber !== rightIsNumber) {
      return leftIsNumber ? 1 : -1;
    }

    if (leftNumber > rightNumber) {
      return 1;
    }

    if (leftNumber < rightNumber) {
      return -1;
    }
  }

  return leftTokens.length - rightTokens.length;
}

function compareDatasetSortValuesWithMode(
  left: DatasetRow,
  right: DatasetRow,
  columnId: string,
  mode: DatasetColumnSortMode,
) {
  const traceBucket = getDatasetSortTraceBucket(columnId);
  const timer = traceBucket ? getSortTimer() : null;
  const startedAt = timer?.now() ?? 0;
  const comparison =
    mode === "alphanumeric"
      ? compareDatasetAlphanumericValues(left, right, columnId)
      : compareBasicValues(
          getCachedDatasetSortValue(left, columnId).normalized,
          getCachedDatasetSortValue(right, columnId).normalized,
        );

  if (traceBucket && timer) {
    const durationMs = timer.now() - startedAt;
    traceBucket.compareCount += 1;
    traceBucket.compareDurationMs += durationMs;

    if (mode === "alphanumeric") {
      traceBucket.alphanumericCompareCount += 1;
      traceBucket.alphanumericCompareDurationMs += durationMs;
    } else {
      traceBucket.textCompareCount += 1;
      traceBucket.textCompareDurationMs += durationMs;
    }
  }

  return comparison;
}

export function getDatasetCellValue(row: DatasetRow, key: string) {
  return row.data[key] ?? "";
}

export function getDatasetColumnSortMode(
  rows: DatasetRow[],
  columnId: string,
): DatasetColumnSortMode {
  let rowCache = datasetColumnSortModeCache.get(rows);

  if (!rowCache) {
    rowCache = new Map();
    datasetColumnSortModeCache.set(rows, rowCache);
  }

  const cachedMode = rowCache.get(columnId);

  if (cachedMode) {
    return cachedMode;
  }

  const traceBucket = getDatasetSortTraceBucket(columnId);
  const timer = traceBucket ? getSortTimer() : null;
  const startedAt = timer?.now() ?? 0;
  let mode: DatasetColumnSortMode = "text";

  for (const row of rows.slice(TEXT_SORT_SAMPLE_OFFSET)) {
    if (getCachedDatasetSortValue(row, columnId).hasNumericToken) {
      mode = "alphanumeric";
      break;
    }
  }

  rowCache.set(columnId, mode);

  if (traceBucket && timer) {
    traceBucket.modeDetectionCount += 1;
    traceBucket.modeDetectionDurationMs += timer.now() - startedAt;

    if (mode === "alphanumeric") {
      traceBucket.detectedAlphanumericCount += 1;
    } else {
      traceBucket.detectedTextCount += 1;
    }
  }

  return mode;
}

export const datasetTextSortingFn: SortingFn<DatasetRow> = (rowA, rowB, columnId) =>
  compareDatasetSortValuesWithMode(
    rowA.original,
    rowB.original,
    columnId,
    "text",
  );

export const datasetAlphanumericSortingFn: SortingFn<DatasetRow> = (
  rowA,
  rowB,
  columnId,
) =>
  compareDatasetSortValuesWithMode(
    rowA.original,
    rowB.original,
    columnId,
    "alphanumeric",
  );

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
    // Keep the remaining columns in dataset/source order so the dataset detail
    // table matches the column-selection UI and uploaded CSV structure.
    ...remainingColumns.sort((left, right) => left.sourceIndex - right.sourceIndex),
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
