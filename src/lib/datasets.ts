import { and, asc, count, desc, eq, sql, type SQL } from "drizzle-orm";

import { getDb } from "@/db";
import { datasetRows, datasets } from "@/db/schema";
import type { CsvColumn, DatasetStatus, DatasetSummary } from "@/lib/api-types";
import { isDatasetOwner } from "@/lib/authz";

function toDatasetSummary(row: typeof datasets.$inferSelect): DatasetSummary {
  return {
    id: row.id,
    fileName: row.fileName,
    blobUrl: row.blobUrl,
    blobPath: row.blobPath,
    status: row.status,
    rowCount: row.rowCount,
    sizeBytes: row.sizeBytes,
    columns: row.columns,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listDatasets(ownerId: string) {
  const rows = await getDb()
    .select()
    .from(datasets)
    .where(eq(datasets.ownerId, ownerId))
    .orderBy(desc(datasets.createdAt));

  return rows.map(toDatasetSummary);
}

export async function getDatasetForOwner(datasetId: string, ownerId: string) {
  const [dataset] = await getDb()
    .select()
    .from(datasets)
    .where(and(eq(datasets.id, datasetId), eq(datasets.ownerId, ownerId)))
    .limit(1);

  return dataset ? toDatasetSummary(dataset) : null;
}

export async function createDataset(input: {
  ownerId: string;
  fileName: string;
  blobUrl: string;
  blobPath: string;
  sizeBytes: number;
  columns: CsvColumn[];
}) {
  const [dataset] = await getDb()
    .insert(datasets)
    .values({
      ownerId: input.ownerId,
      fileName: input.fileName,
      blobUrl: input.blobUrl,
      blobPath: input.blobPath,
      sizeBytes: input.sizeBytes,
      columns: input.columns,
      status: "processing",
      rowCount: 0,
    })
    .returning();

  return toDatasetSummary(dataset);
}

export async function updateDatasetStatus(input: {
  datasetId: string;
  ownerId: string;
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
    .where(and(eq(datasets.id, input.datasetId), eq(datasets.ownerId, input.ownerId)))
    .returning();

  return dataset ? toDatasetSummary(dataset) : null;
}

export async function deleteDatasetForOwner(datasetId: string, ownerId: string) {
  const [dataset] = await getDb()
    .select()
    .from(datasets)
    .where(and(eq(datasets.id, datasetId), eq(datasets.ownerId, ownerId)))
    .limit(1);

  if (!isDatasetOwner(dataset, ownerId)) {
    return null;
  }

  await getDb().delete(datasetRows).where(eq(datasetRows.datasetId, datasetId));
  await getDb().delete(datasets).where(eq(datasets.id, datasetId));

  return toDatasetSummary(dataset);
}

export async function insertDatasetRowBatch(input: {
  datasetId: string;
  ownerId: string;
  rows: Record<string, string>[];
  startIndex: number;
  isFinalBatch: boolean;
  totalRows?: number;
}) {
  const dataset = await getDatasetForOwner(input.datasetId, input.ownerId);

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
    .where(and(eq(datasets.id, input.datasetId), eq(datasets.ownerId, input.ownerId)))
    .returning();

  return toDatasetSummary(updated);
}

export async function getDatasetRows(input: {
  datasetId: string;
  ownerId: string;
  page: number;
  pageSize: number;
  filter?: string;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
}) {
  const dataset = await getDatasetForOwner(input.datasetId, input.ownerId);

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
