import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  ne,
  sql,
  type SQL,
} from "drizzle-orm";

import { getDb } from "@/db";
import { datasetRows, datasets } from "@/db/schema";
import type {
  CsvColumn,
  DatasetStatus,
  DatasetSummary,
  DatasetTag,
} from "@/lib/api-types";
import { getDatasetStorageObjectUrl } from "@/lib/dataset-storage";
import { syncFieldDefinitionsForColumns } from "@/lib/field-definitions";

function toDatasetSummary(row: typeof datasets.$inferSelect): DatasetSummary {
  return {
    id: row.id,
    sortOrder: row.sortOrder,
    fileName: row.fileName,
    blobUrl: row.blobUrl,
    blobPath: row.blobPath,
    isPrimary: row.isPrimary,
    status: row.status,
    rowCount: row.rowCount,
    sizeBytes: row.sizeBytes,
    columns: row.columns,
    tags: row.tags,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listDatasets() {
  const rows = await getDb()
    .select()
    .from(datasets)
    .orderBy(asc(datasets.sortOrder), desc(datasets.createdAt));

  return rows.map(toDatasetSummary);
}

export async function getDataset(datasetId: string) {
  const [dataset] = await getDb()
    .select()
    .from(datasets)
    .where(eq(datasets.id, datasetId))
    .limit(1);

  return dataset ? toDatasetSummary(dataset) : null;
}

export async function getDefaultDataset() {
  const [dataset] = await getDb()
    .select()
    .from(datasets)
    .orderBy(desc(datasets.isPrimary), asc(datasets.sortOrder), desc(datasets.createdAt))
    .limit(1);

  return dataset ? toDatasetSummary(dataset) : null;
}

export async function createDataset(input: {
  ownerId: string;
  fileName: string;
  blobPath: string;
  sizeBytes: number;
  columns: CsvColumn[];
}) {
  const dataset = await getDb().transaction(async (tx) => {
    const [position] = await tx
      .select({
        value: sql<number>`coalesce(max(${datasets.sortOrder}), -1)`,
      })
      .from(datasets);

    const [created] = await tx
      .insert(datasets)
      .values({
        ownerId: input.ownerId,
        fileName: input.fileName,
        sortOrder: (position?.value ?? -1) + 1,
        blobUrl: getDatasetStorageObjectUrl(input.blobPath),
        blobPath: input.blobPath,
        sizeBytes: input.sizeBytes,
        columns: input.columns,
        tags: [],
        status: "processing",
        rowCount: 0,
      })
      .returning();

    await syncFieldDefinitionsForColumns({
      columns: input.columns,
      executor: tx,
    });

    return created;
  });

  return toDatasetSummary(dataset);
}

export async function updateDatasetStatus(input: {
  datasetId: string;
  status: DatasetStatus;
  error?: string | null;
}) {
  const [dataset] = await getDb()
    .update(datasets)
    .set({
      status: input.status,
      error: input.error ?? null,
      updatedAt: new Date(),
    })
    .where(eq(datasets.id, input.datasetId))
    .returning();

  return dataset ? toDatasetSummary(dataset) : null;
}

export async function updateDatasetDetails(input: {
  datasetId: string;
  fileName?: string;
  tags?: DatasetTag[];
  isPrimary?: boolean;
}) {
  return getDb().transaction(async (tx) => {
    const updates: Partial<typeof datasets.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.fileName !== undefined) {
      updates.fileName = input.fileName;
    }

    if (input.tags !== undefined) {
      updates.tags = input.tags;
    }

    if (input.isPrimary !== undefined) {
      updates.isPrimary = input.isPrimary;
    }

    if (input.isPrimary) {
      await tx
        .update(datasets)
        .set({
          isPrimary: false,
          updatedAt: updates.updatedAt,
        })
        .where(and(eq(datasets.isPrimary, true), ne(datasets.id, input.datasetId)));
    }

    const [dataset] = await tx
      .update(datasets)
      .set(updates)
      .where(eq(datasets.id, input.datasetId))
      .returning();

    return dataset ? toDatasetSummary(dataset) : null;
  });
}

export async function replaceDatasetContents(input: {
  datasetId: string;
  fileName: string;
  blobPath: string;
  sizeBytes: number;
  columns: CsvColumn[];
}) {
  return getDb().transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(datasets)
      .where(eq(datasets.id, input.datasetId))
      .limit(1);

    if (!existing) {
      return null;
    }

    await tx.delete(datasetRows).where(eq(datasetRows.datasetId, input.datasetId));

    const [updated] = await tx
      .update(datasets)
      .set({
        fileName: input.fileName,
        blobUrl: getDatasetStorageObjectUrl(input.blobPath),
        blobPath: input.blobPath,
        sizeBytes: input.sizeBytes,
        columns: input.columns,
        tags: existing.tags,
        status: "processing",
        rowCount: 0,
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(datasets.id, input.datasetId))
      .returning();

    await syncFieldDefinitionsForColumns({
      columns: input.columns,
      executor: tx,
    });

    return {
      dataset: toDatasetSummary(updated),
      previousBlobPath: existing.blobPath,
    };
  });
}

export async function deleteDataset(datasetId: string) {
  const [dataset] = await getDb()
    .select()
    .from(datasets)
    .where(eq(datasets.id, datasetId))
    .limit(1);

  if (!dataset) {
    return null;
  }

  await getDb().delete(datasetRows).where(eq(datasetRows.datasetId, datasetId));
  await getDb().delete(datasets).where(eq(datasets.id, datasetId));

  return toDatasetSummary(dataset);
}

export async function reorderDatasets(datasetIds: string[]) {
  return getDb().transaction(async (tx) => {
    const existingDatasets = await tx
      .select({ id: datasets.id })
      .from(datasets)
      .where(inArray(datasets.id, datasetIds));
    const [{ value: totalDatasetCount }] = await tx
      .select({ value: count() })
      .from(datasets);

    if (
      existingDatasets.length !== datasetIds.length ||
      totalDatasetCount !== datasetIds.length
    ) {
      return null;
    }

    for (const [index, datasetId] of datasetIds.entries()) {
      await tx
        .update(datasets)
        .set({ sortOrder: index })
        .where(eq(datasets.id, datasetId));
    }

    const rows = await tx
      .select()
      .from(datasets)
      .orderBy(asc(datasets.sortOrder), desc(datasets.createdAt));

    return rows.map(toDatasetSummary);
  });
}

export async function insertDatasetRowBatch(input: {
  datasetId: string;
  rows: Record<string, string>[];
  startIndex: number;
  isFinalBatch: boolean;
  totalRows?: number;
}) {
  const dataset = await getDataset(input.datasetId);

  if (!dataset) {
    return null;
  }

  if (input.rows.length > 0) {
    await getDb()
      .insert(datasetRows)
      .values(
        input.rows.map((row, index) => ({
          datasetId: input.datasetId,
          rowIndex: input.startIndex + index,
          data: row,
        })),
      )
      .onConflictDoUpdate({
        target: [datasetRows.datasetId, datasetRows.rowIndex],
        set: {
          data: sql`excluded.data`,
        },
      });
  }

  const batchEnd = input.startIndex + input.rows.length;
  const nextRowCount = input.totalRows ?? batchEnd;
  const nextStatus = input.isFinalBatch ? "ready" : "processing";

  const [updated] = await getDb()
    .update(datasets)
    .set({
      rowCount: sql`greatest(${datasets.rowCount}, ${nextRowCount})`,
      status: nextStatus,
      error: null,
      updatedAt: new Date(),
    })
    .where(eq(datasets.id, input.datasetId))
    .returning();

  return toDatasetSummary(updated);
}

export async function getDatasetRows(input: {
  datasetId: string;
  page: number;
  pageSize: number;
  filter?: string;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
}) {
  const dataset = await getDataset(input.datasetId);

  if (!dataset) {
    return null;
  }

  const page = Math.max(input.page, 1);
  const pageSize = Math.min(Math.max(input.pageSize, 1), 1000);
  const offset = (page - 1) * pageSize;
  const predicates: SQL[] = [eq(datasetRows.datasetId, input.datasetId)];

  if (input.filter?.trim()) {
    const filter = `%${input.filter.trim()}%`;
    predicates.push(sql`exists (
      select 1 from jsonb_each_text(${datasetRows.data}) as cell(key, value)
      where cell.value ilike ${filter}
    )`);
  }

  const where = and(...predicates);
  const [{ value: totalRows }] = await getDb()
    .select({ value: count() })
    .from(datasetRows)
    .where(where);

  const canSort =
    input.sortColumn &&
    dataset.columns.some((column) => column.key === input.sortColumn);
  const orderBy = canSort
    ? input.sortDirection === "desc"
      ? desc(sql`${datasetRows.data}->>${input.sortColumn}`)
      : asc(sql`${datasetRows.data}->>${input.sortColumn}`)
    : asc(datasetRows.rowIndex);

  const rows = await getDb()
    .select({
      id: datasetRows.id,
      rowIndex: datasetRows.rowIndex,
      data: datasetRows.data,
    })
    .from(datasetRows)
    .where(where)
    .orderBy(orderBy, asc(datasetRows.rowIndex))
    .limit(pageSize)
    .offset(offset);

  return {
    rows,
    page,
    pageSize,
    totalRows,
    pageCount: Math.max(1, Math.ceil(totalRows / pageSize)),
  };
}

export async function getAllDatasetRows(input: { datasetId: string }) {
  const dataset = await getDataset(input.datasetId);

  if (!dataset) {
    return null;
  }

  const rows = await getDb()
    .select({
      id: datasetRows.id,
      rowIndex: datasetRows.rowIndex,
      data: datasetRows.data,
    })
    .from(datasetRows)
    .where(eq(datasetRows.datasetId, input.datasetId))
    .orderBy(asc(datasetRows.rowIndex));

  return {
    rows,
    page: 1,
    pageSize: rows.length,
    totalRows: rows.length,
    pageCount: 1,
  };
}
