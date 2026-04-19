import { asc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { datasets, fieldDefinitions } from "@/db/schema";
import type {
  CsvColumn,
  FieldDefinition,
  FieldDefinitionLinkedDataset,
  FieldDefinitionPresentation,
} from "@/lib/api-types";
import {
  getFieldDefinitionCanonicalKeyFromLabel,
  getFieldDefinitionCanonicalKeyLookupKeys,
  resolveFieldDefinitionCanonicalKey,
} from "@/lib/field-definition-canonical";
import { getFieldDefinitionEffectiveLabel } from "@/lib/field-definition-presentation";
import {
  listLinkedSourcesByFieldDefinitionId,
} from "@/lib/field-sources";

type FieldDefinitionInsertExecutor = {
  insert: (table: typeof fieldDefinitions) => {
    values: (
      values: Array<{
        canonicalKey: string;
        label: string;
      }>,
    ) => {
      onConflictDoNothing: (input: {
        target: typeof fieldDefinitions.canonicalKey;
      }) => Promise<unknown>;
    };
  };
};

type FieldDefinitionRow = typeof fieldDefinitions.$inferSelect;
type PreferredFieldDefinitionRow = Pick<
  FieldDefinitionRow,
  "id" | "canonicalKey" | "createdAt"
>;

function normalizeFieldDefinitionLabel(label: string, sourceIndex: number) {
  const trimmedLabel = label.trim();
  return trimmedLabel || `Column ${sourceIndex + 1}`;
}

function toFieldDefinition(
  row: FieldDefinitionRow,
  linkedDatasets: FieldDefinitionLinkedDataset[],
  linkedSources: FieldDefinition["linkedSources"],
): FieldDefinition {
  return {
    id: row.id,
    canonicalKey: row.canonicalKey,
    label: row.label,
    displayLabel: row.displayLabel,
    definition: row.definition,
    hideFromViewerFieldDefinitions: row.hideFromViewerFieldDefinitions,
    linkedDatasets,
    linkedSources,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function sortLinkedDatasets(
  linkedDatasets: FieldDefinitionLinkedDataset[],
) {
  return [...linkedDatasets].sort((left, right) =>
    left.fileName.localeCompare(right.fileName, undefined, {
      sensitivity: "base",
    }),
  );
}

function shouldPreferFieldDefinitionRow<TRow extends PreferredFieldDefinitionRow>(
  currentRow: TRow,
  nextRow: TRow,
  resolvedCanonicalKey: string,
) {
  const currentIsCanonical = currentRow.canonicalKey === resolvedCanonicalKey;
  const nextIsCanonical = nextRow.canonicalKey === resolvedCanonicalKey;

  if (currentIsCanonical !== nextIsCanonical) {
    return nextIsCanonical;
  }

  if (currentRow.createdAt.getTime() !== nextRow.createdAt.getTime()) {
    return nextRow.createdAt < currentRow.createdAt;
  }

  return nextRow.id < currentRow.id;
}

function buildPreferredFieldDefinitionRowMap<TRow extends PreferredFieldDefinitionRow>(
  rows: TRow[],
) {
  const rowsByResolvedCanonicalKey = new Map<string, TRow>();

  for (const row of rows) {
    const resolvedCanonicalKey = resolveFieldDefinitionCanonicalKey(
      row.canonicalKey,
    );
    const currentRow = rowsByResolvedCanonicalKey.get(resolvedCanonicalKey);

    if (
      !currentRow ||
      shouldPreferFieldDefinitionRow(currentRow, row, resolvedCanonicalKey)
    ) {
      rowsByResolvedCanonicalKey.set(resolvedCanonicalKey, row);
    }
  }

  return rowsByResolvedCanonicalKey;
}

function buildFieldDefinitionSeedRows(columns: CsvColumn[]) {
  const seenCanonicalKeys = new Set<string>();

  return columns.flatMap((column) => {
    const canonicalKey = getFieldDefinitionCanonicalKey(
      column.label,
      column.sourceIndex,
    );

    if (seenCanonicalKeys.has(canonicalKey)) {
      return [];
    }

    seenCanonicalKeys.add(canonicalKey);

    return [
      {
        canonicalKey,
        label: normalizeFieldDefinitionLabel(column.label, column.sourceIndex),
      },
    ];
  });
}

function buildLinkedDatasetMap(input: {
  datasetsWithColumns: Array<{
    id: string;
    fileName: string;
    columns: CsvColumn[];
  }>;
  allowedCanonicalKeys?: Set<string>;
}) {
  const linkedDatasetMap = new Map<string, FieldDefinitionLinkedDataset[]>();

  for (const dataset of input.datasetsWithColumns) {
    const seenCanonicalKeys = new Set<string>();

    for (const column of dataset.columns) {
      const canonicalKey = getFieldDefinitionCanonicalKey(
        column.label,
        column.sourceIndex,
      );

      if (
        seenCanonicalKeys.has(canonicalKey) ||
        (input.allowedCanonicalKeys &&
          !input.allowedCanonicalKeys.has(canonicalKey))
      ) {
        continue;
      }

      seenCanonicalKeys.add(canonicalKey);

      const linkedDatasets = linkedDatasetMap.get(canonicalKey) ?? [];
      linkedDatasets.push({
        id: dataset.id,
        fileName: dataset.fileName,
      });
      linkedDatasetMap.set(canonicalKey, linkedDatasets);
    }
  }

  return linkedDatasetMap;
}

async function listDatasetsForFieldDefinitions() {
  return getDb()
    .select({
      id: datasets.id,
      fileName: datasets.fileName,
      columns: datasets.columns,
    })
    .from(datasets)
    .orderBy(asc(datasets.fileName), asc(datasets.createdAt));
}

async function listLinkedDatasetsByCanonicalKey(allowedCanonicalKeys?: Set<string>) {
  const datasetsWithColumns = await listDatasetsForFieldDefinitions();

  return buildLinkedDatasetMap({
    datasetsWithColumns,
    allowedCanonicalKeys,
  });
}

export function getFieldDefinitionCanonicalKey(
  label: string,
  sourceIndex: number,
) {
  return getFieldDefinitionCanonicalKeyFromLabel(label, sourceIndex);
}

export async function syncFieldDefinitionsForColumns(input: {
  columns: CsvColumn[];
  executor?: FieldDefinitionInsertExecutor;
}) {
  const rows = buildFieldDefinitionSeedRows(input.columns);

  if (rows.length === 0) {
    return;
  }

  const executor = input.executor ?? getDb();

  await executor
    .insert(fieldDefinitions)
    .values(rows)
    .onConflictDoNothing({
      target: fieldDefinitions.canonicalKey,
    });
}

export async function listFieldDefinitions(options?: {
  includeHidden?: boolean;
}) {
  const rows = await getDb()
    .select()
    .from(fieldDefinitions)
    .orderBy(asc(fieldDefinitions.label), asc(fieldDefinitions.createdAt));
  const visibleRows = options?.includeHidden
    ? rows
    : rows.filter((row) => !row.hideFromViewerFieldDefinitions);
  const preferredRowsByResolvedCanonicalKey =
    buildPreferredFieldDefinitionRowMap(visibleRows);
  const preferredRows = visibleRows.filter(
    (row) =>
      preferredRowsByResolvedCanonicalKey.get(
        resolveFieldDefinitionCanonicalKey(row.canonicalKey),
      )?.id === row.id,
  );
  const linkedDatasetsByCanonicalKey = await listLinkedDatasetsByCanonicalKey(
    new Set(
      preferredRows.map((row) =>
        resolveFieldDefinitionCanonicalKey(row.canonicalKey),
      ),
    ),
  );
  const linkedSourcesByFieldDefinitionId = await listLinkedSourcesByFieldDefinitionId(
    preferredRows.map((row) => ({
      id: row.id,
      sourcePriorityKeys: row.sourcePriorityKeys,
    })),
  );

  return preferredRows.map((row) =>
    toFieldDefinition(
      row,
      sortLinkedDatasets(
        linkedDatasetsByCanonicalKey.get(
          resolveFieldDefinitionCanonicalKey(row.canonicalKey),
        ) ?? [],
      ),
      linkedSourcesByFieldDefinitionId.get(row.id) ?? [],
    ),
  );
}

export async function listFieldDefinitionPresentationByColumnKey(
  columns: CsvColumn[],
) {
  const canonicalKeys = Array.from(
    new Set(
      columns.map((column) =>
        getFieldDefinitionCanonicalKey(column.label, column.sourceIndex),
      ),
    ),
  );

  if (canonicalKeys.length === 0) {
    return {};
  }
  const lookupKeys = Array.from(
    new Set(
      canonicalKeys.flatMap((canonicalKey) =>
        getFieldDefinitionCanonicalKeyLookupKeys(canonicalKey),
      ),
    ),
  );

  const rows = await getDb()
    .select({
      id: fieldDefinitions.id,
      canonicalKey: fieldDefinitions.canonicalKey,
      label: fieldDefinitions.label,
      displayLabel: fieldDefinitions.displayLabel,
      definition: fieldDefinitions.definition,
      sourcePriorityKeys: fieldDefinitions.sourcePriorityKeys,
      createdAt: fieldDefinitions.createdAt,
    })
    .from(fieldDefinitions)
    .where(inArray(fieldDefinitions.canonicalKey, lookupKeys));
  const preferredRows = Array.from(
    buildPreferredFieldDefinitionRowMap(rows).values(),
  );
  const linkedSourcesByFieldDefinitionId = await listLinkedSourcesByFieldDefinitionId(
    preferredRows.map((row) => ({
      id: row.id,
      sourcePriorityKeys: row.sourcePriorityKeys,
    })),
  );

  const presentationByCanonicalKey = new Map(
    preferredRows.map((row) => [
      resolveFieldDefinitionCanonicalKey(row.canonicalKey),
      {
        definition: row.definition,
        displayLabel: row.displayLabel,
        effectiveLabel: getFieldDefinitionEffectiveLabel(row),
        linkedSources: linkedSourcesByFieldDefinitionId.get(row.id) ?? [],
      } satisfies FieldDefinitionPresentation,
    ]),
  );

  return Object.fromEntries(
    columns.map((column) => [
      column.key,
      presentationByCanonicalKey.get(
        getFieldDefinitionCanonicalKey(column.label, column.sourceIndex),
      ) ?? {
        definition: "",
        displayLabel: "",
        effectiveLabel: normalizeFieldDefinitionLabel(
          column.label,
          column.sourceIndex,
        ),
        linkedSources: [],
      },
    ]),
  );
}

export async function updateFieldDefinition(input: {
  fieldDefinitionId: string;
  displayLabel: string;
  definition: string;
  hideFromViewerFieldDefinitions: boolean;
}) {
  const [updatedFieldDefinition] = await getDb()
    .update(fieldDefinitions)
    .set({
      displayLabel: input.displayLabel.trim(),
      definition: input.definition.trim(),
      hideFromViewerFieldDefinitions: input.hideFromViewerFieldDefinitions,
      updatedAt: new Date(),
    })
    .where(eq(fieldDefinitions.id, input.fieldDefinitionId))
    .returning();

  if (!updatedFieldDefinition) {
    return null;
  }

  const resolvedCanonicalKey = resolveFieldDefinitionCanonicalKey(
    updatedFieldDefinition.canonicalKey,
  );
  const linkedDatasetsByCanonicalKey = await listLinkedDatasetsByCanonicalKey(
    new Set([resolvedCanonicalKey]),
  );
  const linkedSourcesByFieldDefinitionId = await listLinkedSourcesByFieldDefinitionId([
    {
      id: updatedFieldDefinition.id,
      sourcePriorityKeys: updatedFieldDefinition.sourcePriorityKeys,
    },
  ]);

  return toFieldDefinition(
    updatedFieldDefinition,
    sortLinkedDatasets(
      linkedDatasetsByCanonicalKey.get(resolvedCanonicalKey) ?? [],
    ),
    linkedSourcesByFieldDefinitionId.get(updatedFieldDefinition.id) ?? [],
  );
}
