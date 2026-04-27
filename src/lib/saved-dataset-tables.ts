import { and, count, desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { datasets, savedDatasetTables } from "@/db/schema";
import type {
  SavedDatasetFilterState,
  SavedDatasetTable,
} from "@/lib/api-types";
import { normalizeSavedDatasetFilterState } from "@/lib/saved-dataset-filters";

function stripCsvExtension(value: string) {
  return value.trim().replace(/\.csv$/iu, "");
}

function getDefaultSavedDatasetTableName(fileName: string, sequence: number) {
  return `${stripCsvExtension(fileName) || "Dataset"} Saved view ${sequence}`;
}

type SavedDatasetTableAccessOptions = {
  includeDisabled?: boolean;
};

function toSavedDatasetTable(row: {
  id: string;
  datasetId: string;
  datasetFileName: string;
  name: string;
  details: string;
  filters: SavedDatasetFilterState;
  savedRowCount: number;
  createdAt: Date;
  updatedAt: Date;
}): SavedDatasetTable {
  return {
    id: row.id,
    datasetId: row.datasetId,
    datasetFileName: row.datasetFileName,
    name: row.name,
    details: row.details,
    filters: normalizeSavedDatasetFilterState(row.filters),
    savedRowCount: row.savedRowCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function getSavedDatasetTableQuery(input: {
  ownerId: string;
  savedTableId?: string;
  includeDisabled?: boolean;
}) {
  const predicates = [eq(savedDatasetTables.ownerId, input.ownerId)];

  if (!input.includeDisabled) {
    predicates.push(eq(datasets.isPublic, true));
  }

  if (input.savedTableId) {
    predicates.push(eq(savedDatasetTables.id, input.savedTableId));
  }

  return getDb()
    .select({
      id: savedDatasetTables.id,
      datasetId: savedDatasetTables.datasetId,
      datasetFileName: datasets.fileName,
      name: savedDatasetTables.name,
      details: savedDatasetTables.details,
      filters: savedDatasetTables.filters,
      savedRowCount: savedDatasetTables.savedRowCount,
      createdAt: savedDatasetTables.createdAt,
      updatedAt: savedDatasetTables.updatedAt,
    })
    .from(savedDatasetTables)
    .innerJoin(datasets, eq(savedDatasetTables.datasetId, datasets.id))
    .where(and(...predicates));
}

export async function listSavedDatasetTables(
  ownerId: string,
  options: SavedDatasetTableAccessOptions = {},
) {
  const rows = await getSavedDatasetTableQuery({
    ownerId,
    includeDisabled: options.includeDisabled,
  }).orderBy(
    desc(savedDatasetTables.updatedAt),
    desc(savedDatasetTables.createdAt),
  );

  return rows.map(toSavedDatasetTable);
}

export async function getSavedDatasetTable(input: {
  ownerId: string;
  savedTableId: string;
  includeDisabled?: boolean;
}) {
  const [row] = await getSavedDatasetTableQuery(input).limit(1);
  return row ? toSavedDatasetTable(row) : null;
}

export async function createSavedDatasetTable(input: {
  ownerId: string;
  datasetId: string;
  filters: SavedDatasetFilterState;
  savedRowCount: number;
  includeDisabled?: boolean;
}) {
  return getDb().transaction(async (tx) => {
    const datasetPredicates = [eq(datasets.id, input.datasetId)];

    if (!input.includeDisabled) {
      datasetPredicates.push(eq(datasets.isPublic, true));
    }

    const [dataset] = await tx
      .select({
        id: datasets.id,
        fileName: datasets.fileName,
      })
      .from(datasets)
      .where(and(...datasetPredicates))
      .limit(1);

    if (!dataset) {
      return null;
    }

    const [{ value: existingCount }] = await tx
      .select({
        value: count(),
      })
      .from(savedDatasetTables)
      .where(
        and(
          eq(savedDatasetTables.ownerId, input.ownerId),
          eq(savedDatasetTables.datasetId, input.datasetId),
        ),
      );

    const [savedTable] = await tx
      .insert(savedDatasetTables)
      .values({
        ownerId: input.ownerId,
        datasetId: input.datasetId,
        name: getDefaultSavedDatasetTableName(
          dataset.fileName,
          (existingCount ?? 0) + 1,
        ),
        details: "",
        filters: input.filters,
        savedRowCount: input.savedRowCount,
      })
      .returning();

    return toSavedDatasetTable({
      ...savedTable,
      datasetFileName: dataset.fileName,
    });
  });
}

export async function updateSavedDatasetTable(input: {
  ownerId: string;
  savedTableId: string;
  name?: string;
  details?: string;
  includeDisabled?: boolean;
}) {
  const existing = await getSavedDatasetTable({
    ownerId: input.ownerId,
    savedTableId: input.savedTableId,
    includeDisabled: input.includeDisabled,
  });

  if (!existing) {
    return null;
  }

  const [updated] = await getDb()
    .update(savedDatasetTables)
    .set({
      name: input.name,
      details: input.details,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(savedDatasetTables.ownerId, input.ownerId),
        eq(savedDatasetTables.id, input.savedTableId),
      ),
    )
    .returning({
      id: savedDatasetTables.id,
    });

  if (!updated) {
    return null;
  }

  return getSavedDatasetTable({
    ownerId: input.ownerId,
    savedTableId: updated.id,
    includeDisabled: input.includeDisabled,
  });
}

export async function deleteSavedDatasetTable(input: {
  ownerId: string;
  savedTableId: string;
  includeDisabled?: boolean;
}) {
  const savedTable = await getSavedDatasetTable(input);

  if (!savedTable) {
    return null;
  }

  await getDb()
    .delete(savedDatasetTables)
    .where(
      and(
        eq(savedDatasetTables.ownerId, input.ownerId),
        eq(savedDatasetTables.id, input.savedTableId),
      ),
    );

  return savedTable;
}
