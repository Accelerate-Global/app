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
import {
  datasetRows,
  datasetVersionRows,
  datasetVersions,
  datasets,
} from "@/db/schema";
import type {
  CsvColumn,
  DatasetStatus,
  DatasetSummary,
  DatasetTag,
  DatasetVersionSummary,
} from "@/lib/api-types";
import { normalizeDatasetHiddenColumnKeys } from "@/lib/dataset-column-visibility";
import { getDatasetStorageObjectUrl } from "@/lib/dataset-storage";
import { getDatasetOpenPresetTag, normalizeDatasetTags } from "@/lib/dataset-tags";
import { syncFieldDefinitionsForColumns } from "@/lib/field-definitions";
import { getUnsupportedDatasetOpenPresetSections } from "@/lib/saved-dataset-filters";

type DbExecutor = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
type DatasetRecord = typeof datasets.$inferSelect;
type DatasetVersionRecord = typeof datasetVersions.$inferSelect;

function toDatasetSummary(row: DatasetRecord): DatasetSummary {
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
    hiddenColumnKeys: row.hiddenColumnKeys,
    tags: row.tags,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toCurrentDatasetVersionSummary(row: DatasetRecord): DatasetVersionSummary {
  return {
    id: row.id,
    datasetId: row.id,
    isCurrent: true,
    fileName: row.fileName,
    action: row.currentVersionAction,
    actorOwnerId: row.currentVersionActorOwnerId,
    actorEmail: row.currentVersionActorEmail,
    status: row.status,
    rowCount: row.rowCount,
    sizeBytes: row.sizeBytes,
    columnCount: row.columns.length,
    versionCreatedAt: row.currentVersionCreatedAt.toISOString(),
    archivedAt: null,
  };
}

function toDatasetVersionSummary(row: DatasetVersionRecord): DatasetVersionSummary {
  return {
    id: row.id,
    datasetId: row.datasetId,
    isCurrent: false,
    fileName: row.fileName,
    action: row.action,
    actorOwnerId: row.actorOwnerId,
    actorEmail: row.actorEmail,
    status: row.status,
    rowCount: row.rowCount,
    sizeBytes: row.sizeBytes,
    columnCount: row.columns.length,
    versionCreatedAt: row.versionCreatedAt.toISOString(),
    archivedAt: row.archivedAt.toISOString(),
  };
}

export class DatasetVersionRevertConflictError extends Error {
  readonly status = 409;

  constructor(message = "Only ready dataset versions can be reverted.") {
    super(message);
    this.name = "DatasetVersionRevertConflictError";
  }
}

export class DatasetOpenPresetCompatibilityError extends Error {
  readonly status = 400;

  constructor(message = "The dataset open preset is not supported by this dataset.") {
    super(message);
    this.name = "DatasetOpenPresetCompatibilityError";
  }
}

async function archiveDatasetVersion(tx: DbExecutor, dataset: DatasetRecord) {
  const [version] = await tx
    .insert(datasetVersions)
    .values({
      datasetId: dataset.id,
      fileName: dataset.fileName,
      blobUrl: dataset.blobUrl,
      blobPath: dataset.blobPath,
      action: dataset.currentVersionAction,
      actorOwnerId: dataset.currentVersionActorOwnerId,
      actorEmail: dataset.currentVersionActorEmail,
      status: dataset.status,
      rowCount: dataset.rowCount,
      sizeBytes: dataset.sizeBytes,
      columns: dataset.columns,
      error: dataset.error,
      versionCreatedAt: dataset.currentVersionCreatedAt,
    })
    .returning();

  await tx.execute(sql`
    insert into ${datasetVersionRows} (
      "version_id",
      "row_index",
      "data"
    )
    select
      ${version.id},
      ${datasetRows.rowIndex},
      ${datasetRows.data}
    from ${datasetRows}
    where ${datasetRows.datasetId} = ${dataset.id}
  `);

  return version;
}

async function restoreDatasetVersionRows(
  tx: DbExecutor,
  datasetId: string,
  versionId: string,
) {
  await tx.execute(sql`
    insert into ${datasetRows} (
      "dataset_id",
      "row_index",
      "data"
    )
    select
      ${datasetId},
      ${datasetVersionRows.rowIndex},
      ${datasetVersionRows.data}
    from ${datasetVersionRows}
    where ${datasetVersionRows.versionId} = ${versionId}
  `);
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

export async function listDatasetVersions(datasetId: string) {
  const [dataset] = await getDb()
    .select()
    .from(datasets)
    .where(eq(datasets.id, datasetId))
    .limit(1);

  if (!dataset) {
    return null;
  }

  const versions = await getDb()
    .select()
    .from(datasetVersions)
    .where(eq(datasetVersions.datasetId, datasetId))
    .orderBy(desc(datasetVersions.versionCreatedAt), desc(datasetVersions.archivedAt));

  return [
    toCurrentDatasetVersionSummary(dataset),
    ...versions.map(toDatasetVersionSummary),
  ];
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
  actorEmail?: string | null;
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

    const now = new Date();
    const [created] = await tx
      .insert(datasets)
      .values({
        ownerId: input.ownerId,
        fileName: input.fileName,
        sortOrder: (position?.value ?? -1) + 1,
        blobUrl: getDatasetStorageObjectUrl(input.blobPath),
        blobPath: input.blobPath,
        currentVersionAction: "upload",
        currentVersionActorOwnerId: input.ownerId,
        currentVersionActorEmail: input.actorEmail ?? null,
        currentVersionCreatedAt: now,
        sizeBytes: input.sizeBytes,
        columns: input.columns,
        hiddenColumnKeys: [],
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
  hiddenColumnKeys?: string[];
}) {
  return getDb().transaction(async (tx) => {
    const [existingDataset] = await tx
      .select()
      .from(datasets)
      .where(eq(datasets.id, input.datasetId))
      .limit(1);

    if (!existingDataset) {
      return null;
    }

    const updates: Partial<typeof datasets.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.fileName !== undefined) {
      updates.fileName = input.fileName;
    }

    if (input.tags !== undefined) {
      const normalizedTags = normalizeDatasetTags(input.tags);
      const presetTag = getDatasetOpenPresetTag(normalizedTags);

      if (presetTag?.openPreset) {
        const unsupportedSections = getUnsupportedDatasetOpenPresetSections(
          existingDataset,
          presetTag.openPreset,
        );

        if (unsupportedSections.length > 0) {
          throw new DatasetOpenPresetCompatibilityError(
            `The "${presetTag.label}" preset requires ${unsupportedSections.join(", ")} filtering support on this dataset.`,
          );
        }
      }

      updates.tags = normalizedTags;
    }

    if (input.hiddenColumnKeys !== undefined) {
      updates.hiddenColumnKeys = normalizeDatasetHiddenColumnKeys(
        input.hiddenColumnKeys,
        existingDataset.columns,
      );
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
  actorOwnerId: string;
  actorEmail?: string | null;
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

    await archiveDatasetVersion(tx, existing);
    await tx.delete(datasetRows).where(eq(datasetRows.datasetId, input.datasetId));

    const now = new Date();
    const [updated] = await tx
      .update(datasets)
      .set({
        fileName: existing.fileName,
        blobUrl: getDatasetStorageObjectUrl(input.blobPath),
        blobPath: input.blobPath,
        currentVersionAction: "replace",
        currentVersionActorOwnerId: input.actorOwnerId,
        currentVersionActorEmail: input.actorEmail ?? null,
        currentVersionCreatedAt: now,
        sizeBytes: input.sizeBytes,
        columns: input.columns,
        hiddenColumnKeys: normalizeDatasetHiddenColumnKeys(
          existing.hiddenColumnKeys,
          input.columns,
        ),
        tags: existing.tags,
        status: "processing",
        rowCount: 0,
        error: null,
        updatedAt: now,
      })
      .where(eq(datasets.id, input.datasetId))
      .returning();

    await syncFieldDefinitionsForColumns({
      columns: input.columns,
      executor: tx,
    });

    return {
      dataset: toDatasetSummary(updated),
    };
  });
}

export async function revertDatasetVersion(input: {
  datasetId: string;
  versionId: string;
  actorOwnerId: string;
  actorEmail?: string | null;
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

    const [version] = await tx
      .select()
      .from(datasetVersions)
      .where(
        and(
          eq(datasetVersions.id, input.versionId),
          eq(datasetVersions.datasetId, input.datasetId),
        ),
      )
      .limit(1);

    if (!version) {
      return null;
    }

    if (version.status !== "ready") {
      throw new DatasetVersionRevertConflictError();
    }

    await archiveDatasetVersion(tx, existing);
    await tx.delete(datasetRows).where(eq(datasetRows.datasetId, input.datasetId));
    await restoreDatasetVersionRows(tx, input.datasetId, input.versionId);

    const now = new Date();
    const [updated] = await tx
      .update(datasets)
      .set({
        fileName: existing.fileName,
        blobUrl: version.blobUrl,
        blobPath: version.blobPath,
        currentVersionAction: "revert",
        currentVersionActorOwnerId: input.actorOwnerId,
        currentVersionActorEmail: input.actorEmail ?? null,
        currentVersionCreatedAt: now,
        status: version.status,
        rowCount: version.rowCount,
        sizeBytes: version.sizeBytes,
        columns: version.columns,
        hiddenColumnKeys: normalizeDatasetHiddenColumnKeys(
          existing.hiddenColumnKeys,
          version.columns,
        ),
        error: version.error,
        updatedAt: now,
      })
      .where(eq(datasets.id, input.datasetId))
      .returning();

    await syncFieldDefinitionsForColumns({
      columns: version.columns,
      executor: tx,
    });

    return {
      dataset: toDatasetSummary(updated),
    };
  });
}

export async function deleteDataset(datasetId: string) {
  return getDb().transaction(async (tx) => {
    const [dataset] = await tx
      .select()
      .from(datasets)
      .where(eq(datasets.id, datasetId))
      .limit(1);

    if (!dataset) {
      return null;
    }

    const versionBlobRows = await tx
      .select({ blobPath: datasetVersions.blobPath })
      .from(datasetVersions)
      .where(eq(datasetVersions.datasetId, datasetId));

    await tx.delete(datasetRows).where(eq(datasetRows.datasetId, datasetId));
    await tx.delete(datasets).where(eq(datasets.id, datasetId));

    return {
      dataset: toDatasetSummary(dataset),
      blobPaths: [...new Set([dataset.blobPath, ...versionBlobRows.map((row) => row.blobPath)])],
    };
  });
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
