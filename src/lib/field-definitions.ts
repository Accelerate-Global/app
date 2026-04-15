import { asc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { datasets, fieldDefinitions } from "@/db/schema";
import type {
  CsvColumn,
  FieldDefinition,
  FieldDefinitionLinkedDataset,
  FieldDefinitionPresentation,
} from "@/lib/api-types";
import { normalizeHeaderIdentity } from "@/lib/csv";
import { getFieldDefinitionEffectiveLabel } from "@/lib/field-definition-presentation";

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

function normalizeFieldDefinitionLabel(label: string, sourceIndex: number) {
  const trimmedLabel = label.trim();
  return trimmedLabel || `Column ${sourceIndex + 1}`;
}

function toFieldDefinition(
  row: FieldDefinitionRow,
  linkedDatasets: FieldDefinitionLinkedDataset[],
): FieldDefinition {
  return {
    id: row.id,
    canonicalKey: row.canonicalKey,
    label: row.label,
    displayLabel: row.displayLabel,
    definition: row.definition,
    linkedDatasets,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toFieldDefinitionPresentation(row: Pick<
  FieldDefinitionRow,
  "label" | "displayLabel" | "definition"
>): FieldDefinitionPresentation {
  return {
    definition: row.definition,
    displayLabel: row.displayLabel,
    effectiveLabel: getFieldDefinitionEffectiveLabel(row),
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
  return normalizeHeaderIdentity(label, sourceIndex);
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

export async function listFieldDefinitions() {
  const [rows, linkedDatasetsByCanonicalKey] = await Promise.all([
    getDb()
      .select()
      .from(fieldDefinitions)
      .orderBy(asc(fieldDefinitions.label), asc(fieldDefinitions.createdAt)),
    listLinkedDatasetsByCanonicalKey(),
  ]);

  return rows.map((row) =>
    toFieldDefinition(
      row,
      sortLinkedDatasets(
        linkedDatasetsByCanonicalKey.get(row.canonicalKey) ?? [],
      ),
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

  const rows = await getDb()
    .select({
      canonicalKey: fieldDefinitions.canonicalKey,
      label: fieldDefinitions.label,
      displayLabel: fieldDefinitions.displayLabel,
      definition: fieldDefinitions.definition,
    })
    .from(fieldDefinitions)
    .where(inArray(fieldDefinitions.canonicalKey, canonicalKeys));

  const presentationByCanonicalKey = new Map(
    rows.map((row) => [row.canonicalKey, toFieldDefinitionPresentation(row)]),
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
      },
    ]),
  );
}

export async function updateFieldDefinition(input: {
  fieldDefinitionId: string;
  displayLabel: string;
  definition: string;
}) {
  const [updatedFieldDefinition] = await getDb()
    .update(fieldDefinitions)
    .set({
      displayLabel: input.displayLabel.trim(),
      definition: input.definition.trim(),
      updatedAt: new Date(),
    })
    .where(eq(fieldDefinitions.id, input.fieldDefinitionId))
    .returning();

  if (!updatedFieldDefinition) {
    return null;
  }

  const linkedDatasetsByCanonicalKey = await listLinkedDatasetsByCanonicalKey(
    new Set([updatedFieldDefinition.canonicalKey]),
  );

  return toFieldDefinition(
    updatedFieldDefinition,
    sortLinkedDatasets(
      linkedDatasetsByCanonicalKey.get(updatedFieldDefinition.canonicalKey) ?? [],
    ),
  );
}
