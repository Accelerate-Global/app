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
  filterRegionCountries,
  filterRegions,
} from "@/db/schema";
import type {
  CsvColumn,
  DatasetStatus,
  FilterRegion,
  SavedDatasetFilterState,
  DatasetSummary,
  DatasetTag,
  DatasetVersionSummary,
} from "@/lib/api-types";
import { countDatasetDefaultRows } from "@/lib/dataset-default-view";
import { normalizeDatasetHiddenColumnKeys } from "@/lib/dataset-column-visibility";
import { getDatasetStorageObjectUrl } from "@/lib/dataset-storage";
import { normalizeDatasetTags } from "@/lib/dataset-tags";
import { syncFieldDefinitionsForColumns } from "@/lib/field-definitions";
import { normalizeSavedDatasetFilterState } from "@/lib/saved-dataset-filters";

type DbExecutor = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
type DatasetRecord = typeof datasets.$inferSelect;
type DatasetVersionRecord = typeof datasetVersions.$inferSelect;
type DatasetAccessOptions = {
  includeDisabled?: boolean;
};

function toDatasetSummary(row: DatasetRecord): DatasetSummary {
  return {
    id: row.id,
    backingDatasetId: row.backingDatasetId,
    sortOrder: row.sortOrder,
    fileName: row.fileName,
    sourceOrganizationName: row.sourceOrganizationName?.trim() || null,
    blobUrl: row.blobUrl,
    blobPath: row.blobPath,
    isPrimary: row.isPrimary,
    isPublic: row.isPublic,
    status: row.status,
    rowCount: row.rowCount,
    sizeBytes: row.sizeBytes,
    columns: row.columns,
    hiddenColumnKeys: row.hiddenColumnKeys,
    defaultFilters: row.defaultFilters
      ? normalizeSavedDatasetFilterState(row.defaultFilters)
      : null,
    tags: normalizeDatasetTags(row.tags),
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

export class DerivedDatasetMutationError extends Error {
  readonly status = 409;

  constructor(message = "Derived dataset views cannot change their backing data.") {
    super(message);
    this.name = "DerivedDatasetMutationError";
  }
}

export class DerivedDatasetSourceConflictError extends Error {
  readonly status = 409;

  constructor(
    message = "Derived dataset views must reference a physical dataset.",
  ) {
    super(message);
    this.name = "DerivedDatasetSourceConflictError";
  }
}

export class DatasetDeleteConflictError extends Error {
  readonly status = 409;

  constructor(
    message = "Datasets used as a backing source cannot be deleted while derived views still reference them.",
  ) {
    super(message);
    this.name = "DatasetDeleteConflictError";
  }
}

async function getDatasetRecord(
  datasetId: string,
  executor: Pick<ReturnType<typeof getDb>, "select"> = getDb(),
) {
  const [dataset] = await executor
    .select()
    .from(datasets)
    .where(eq(datasets.id, datasetId))
    .limit(1);

  return dataset ?? null;
}

async function getAccessibleDatasetRecord(input: {
  datasetId: string;
  executor?: Pick<ReturnType<typeof getDb>, "select">;
  includeDisabled?: boolean;
}) {
  const executor = input.executor ?? getDb();
  const predicates: SQL[] = [eq(datasets.id, input.datasetId)];

  if (!input.includeDisabled) {
    predicates.push(eq(datasets.isPublic, true));
  }

  const [dataset] = await executor
    .select()
    .from(datasets)
    .where(and(...predicates))
    .limit(1);

  return dataset ?? null;
}

async function resolveDatasetSourceRecord(
  input:
    | {
        datasetId: string;
        executor?: Pick<ReturnType<typeof getDb>, "select">;
      }
    | {
        dataset: DatasetRecord;
        executor?: Pick<ReturnType<typeof getDb>, "select">;
      },
) {
  const executor = input.executor ?? getDb();
  const dataset =
    "dataset" in input ? input.dataset : await getDatasetRecord(input.datasetId, executor);

  if (!dataset) {
    return null;
  }

  if (!dataset.backingDatasetId) {
    return {
      dataset,
      sourceDataset: dataset,
    };
  }

  if (dataset.backingDatasetId === dataset.id) {
    throw new DerivedDatasetSourceConflictError(
      "Derived dataset views cannot reference themselves as a backing dataset.",
    );
  }

  const sourceDataset = await getDatasetRecord(dataset.backingDatasetId, executor);

  if (!sourceDataset) {
    throw new DerivedDatasetSourceConflictError(
      "The backing dataset for this derived view could not be found.",
    );
  }

  if (sourceDataset.backingDatasetId) {
    throw new DerivedDatasetSourceConflictError();
  }

  return {
    dataset,
    sourceDataset,
  };
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

async function listFilterRegionsForDatasetCalculations(
  executor: Pick<ReturnType<typeof getDb>, "select"> = getDb(),
) {
  const rows = await executor
    .select({
      id: filterRegions.id,
      name: filterRegions.name,
      description: filterRegions.description,
      sortOrder: filterRegions.sortOrder,
      createdAt: filterRegions.createdAt,
      updatedAt: filterRegions.updatedAt,
      countryName: filterRegionCountries.countryName,
    })
    .from(filterRegions)
    .leftJoin(
      filterRegionCountries,
      eq(filterRegionCountries.regionId, filterRegions.id),
    )
    .orderBy(
      asc(filterRegions.sortOrder),
      asc(filterRegions.name),
      asc(filterRegionCountries.countryName),
    );

  const regions = new Map<
    string,
    Omit<FilterRegion, "createdAt" | "updatedAt"> & {
      createdAt: Date;
      updatedAt: Date;
    }
  >();

  for (const row of rows) {
    const existing =
      regions.get(row.id) ??
      {
        id: row.id,
        name: row.name,
        description: row.description,
        sortOrder: row.sortOrder,
        countries: [],
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };

    if (row.countryName) {
      existing.countries.push(row.countryName);
    }

    regions.set(row.id, existing);
  }

  return Array.from(regions.values()).map((region) => ({
    ...region,
    countries: [...region.countries].sort((left, right) =>
      left.localeCompare(right),
    ),
    createdAt: region.createdAt.toISOString(),
    updatedAt: region.updatedAt.toISOString(),
  }));
}

async function listDatasetRowsByDatasetId(
  datasetId: string,
  executor: Pick<ReturnType<typeof getDb>, "select"> = getDb(),
) {
  return executor
    .select({
      id: datasetRows.id,
      rowIndex: datasetRows.rowIndex,
      data: datasetRows.data,
    })
    .from(datasetRows)
    .where(eq(datasetRows.datasetId, datasetId))
    .orderBy(asc(datasetRows.rowIndex));
}

async function refreshDerivedDatasets(input?: {
  sourceDatasetId?: string;
  executor?: Pick<ReturnType<typeof getDb>, "select" | "update">;
}) {
  const executor = input?.executor ?? getDb();
  const predicates: SQL[] = [sql`${datasets.backingDatasetId} is not null`];

  if (input?.sourceDatasetId) {
    predicates.push(eq(datasets.backingDatasetId, input.sourceDatasetId));
  }

  const derivedDatasets = await executor
    .select()
    .from(datasets)
    .where(and(...predicates));

  if (derivedDatasets.length === 0) {
    return;
  }

  const regions = await listFilterRegionsForDatasetCalculations(executor);
  const derivedDatasetsBySourceId = new Map<string, DatasetRecord[]>();

  for (const derivedDataset of derivedDatasets) {
    if (!derivedDataset.backingDatasetId) {
      continue;
    }

    const existing = derivedDatasetsBySourceId.get(derivedDataset.backingDatasetId) ?? [];
    existing.push(derivedDataset);
    derivedDatasetsBySourceId.set(derivedDataset.backingDatasetId, existing);
  }

  const now = new Date();

  for (const [sourceDatasetId, sourceDerivedDatasets] of derivedDatasetsBySourceId) {
    const sourceDataset = await getDatasetRecord(sourceDatasetId, executor);

    if (!sourceDataset) {
      continue;
    }

    if (sourceDataset.backingDatasetId) {
      throw new DerivedDatasetSourceConflictError();
    }

    const sourceRows = await listDatasetRowsByDatasetId(sourceDatasetId, executor);

    for (const derivedDataset of sourceDerivedDatasets) {
      await executor
        .update(datasets)
        .set({
          columns: sourceDataset.columns,
          hiddenColumnKeys: normalizeDatasetHiddenColumnKeys(
            derivedDataset.hiddenColumnKeys,
            sourceDataset.columns,
          ),
          rowCount: countDatasetDefaultRows({
            dataset: {
              columns: sourceDataset.columns,
              defaultFilters: derivedDataset.defaultFilters
                ? normalizeSavedDatasetFilterState(derivedDataset.defaultFilters)
                : null,
            },
            rows: sourceRows,
            regions,
          }),
          status: sourceDataset.status,
          error: sourceDataset.error,
          updatedAt: now,
        })
        .where(eq(datasets.id, derivedDataset.id));
    }
  }
}

export async function refreshDerivedDatasetsForSource(sourceDatasetId: string) {
  await refreshDerivedDatasets({ sourceDatasetId });
}

export async function refreshAllDerivedDatasets() {
  await refreshDerivedDatasets();
}

export async function listDatasets(options: DatasetAccessOptions = {}) {
  const query = getDb().select().from(datasets);
  const rows = await (
    options.includeDisabled ? query : query.where(eq(datasets.isPublic, true))
  ).orderBy(asc(datasets.sortOrder), desc(datasets.createdAt));

  return rows.map(toDatasetSummary);
}

export async function getDataset(
  datasetId: string,
  options: DatasetAccessOptions = {},
) {
  const dataset = await getAccessibleDatasetRecord({
    datasetId,
    includeDisabled: options.includeDisabled,
  });

  return dataset ? toDatasetSummary(dataset) : null;
}

export async function listDatasetVersions(datasetId: string) {
  const dataset = await getDatasetRecord(datasetId);

  if (!dataset) {
    return null;
  }

  if (dataset.backingDatasetId) {
    return [] as DatasetVersionSummary[];
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

export async function getDefaultDataset(options: DatasetAccessOptions = {}) {
  const query = getDb().select().from(datasets);
  const [dataset] = await (
    options.includeDisabled ? query : query.where(eq(datasets.isPublic, true))
  )
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
        backingDatasetId: null,
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
        defaultFilters: null,
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

  if (!dataset) {
    return null;
  }

  const summary = toDatasetSummary(dataset);

  if (!summary.backingDatasetId) {
    await refreshDerivedDatasetsForSource(summary.id);
  }

  return summary;
}

export async function updateDatasetDetails(input: {
  datasetId: string;
  fileName?: string;
  sourceOrganizationName?: string | null;
  tags?: DatasetTag[];
  isPrimary?: boolean;
  isPublic?: boolean;
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

    if (input.sourceOrganizationName !== undefined) {
      if (existingDataset.backingDatasetId) {
        throw new DerivedDatasetMutationError(
          "Derived dataset views cannot define a source organization.",
        );
      }

      updates.sourceOrganizationName = input.sourceOrganizationName?.trim() || null;
    }

    if (input.tags !== undefined) {
      updates.tags = normalizeDatasetTags(input.tags);
    }

    if (input.hiddenColumnKeys !== undefined) {
      updates.hiddenColumnKeys = normalizeDatasetHiddenColumnKeys(
        input.hiddenColumnKeys,
        existingDataset.columns,
      );
    }

    if (input.isPublic !== undefined) {
      updates.isPublic = input.isPublic;
    }

    if (input.isPrimary !== undefined) {
      if (input.isPrimary && existingDataset.backingDatasetId) {
        throw new DerivedDatasetMutationError(
          "Derived dataset views cannot be marked as primary.",
        );
      }

      updates.isPrimary = input.isPrimary;
    }

    const nextIsPublic = updates.isPublic ?? existingDataset.isPublic;

    if (!nextIsPublic) {
      updates.isPrimary = false;
    }

    if (updates.isPrimary === true) {
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

export async function assignDatasetDerivedView(input: {
  datasetId: string;
  sourceDatasetId: string;
  filters: SavedDatasetFilterState;
}) {
  return getDb().transaction(async (tx) => {
    const [targetDataset] = await tx
      .select()
      .from(datasets)
      .where(eq(datasets.id, input.datasetId))
      .limit(1);

    if (!targetDataset) {
      return null;
    }

    const resolvedSource = await resolveDatasetSourceRecord({
      datasetId: input.sourceDatasetId,
      executor: tx,
    });

    if (!resolvedSource) {
      return null;
    }

    const sourceDataset = resolvedSource.sourceDataset;

    if (sourceDataset.id === targetDataset.id) {
      throw new DerivedDatasetSourceConflictError(
        "Derived dataset views cannot reference themselves as a backing dataset.",
      );
    }

    const normalizedFilters = normalizeSavedDatasetFilterState(input.filters);

    if (!targetDataset.backingDatasetId && targetDataset.rowCount > 0) {
      await archiveDatasetVersion(tx, targetDataset);
    }

    await tx.delete(datasetRows).where(eq(datasetRows.datasetId, targetDataset.id));

    const [regions, sourceRows] = await Promise.all([
      listFilterRegionsForDatasetCalculations(tx),
      listDatasetRowsByDatasetId(sourceDataset.id, tx),
    ]);
    const now = new Date();
    const [updated] = await tx
      .update(datasets)
      .set({
        backingDatasetId: sourceDataset.id,
        columns: sourceDataset.columns,
        hiddenColumnKeys: normalizeDatasetHiddenColumnKeys(
          targetDataset.hiddenColumnKeys,
          sourceDataset.columns,
        ),
        defaultFilters: normalizedFilters,
        sourceOrganizationName: null,
        isPrimary: false,
        status: sourceDataset.status,
        rowCount: countDatasetDefaultRows({
          dataset: {
            columns: sourceDataset.columns,
            defaultFilters: normalizedFilters,
          },
          rows: sourceRows,
          regions,
        }),
        error: sourceDataset.error,
        updatedAt: now,
      })
      .where(eq(datasets.id, input.datasetId))
      .returning();

    await syncFieldDefinitionsForColumns({
      columns: sourceDataset.columns,
      executor: tx,
    });

    return updated ? toDatasetSummary(updated) : null;
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
  const replacement = await getDb().transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(datasets)
      .where(eq(datasets.id, input.datasetId))
      .limit(1);

    if (!existing) {
      return null;
    }

    // Derived views do not own standalone row history yet, so materializing them
    // starts a new physical dataset instead of archiving the inherited view state.
    if (!existing.backingDatasetId) {
      await archiveDatasetVersion(tx, existing);
    }
    await tx.delete(datasetRows).where(eq(datasetRows.datasetId, input.datasetId));

    const now = new Date();
    const [updated] = await tx
      .update(datasets)
      .set({
        backingDatasetId: null,
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
        defaultFilters: null,
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

  if (!replacement) {
    return null;
  }

  await refreshDerivedDatasetsForSource(replacement.dataset.id);

  return replacement;
}

export async function revertDatasetVersion(input: {
  datasetId: string;
  versionId: string;
  actorOwnerId: string;
  actorEmail?: string | null;
}) {
  const reverted = await getDb().transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(datasets)
      .where(eq(datasets.id, input.datasetId))
      .limit(1);

    if (!existing) {
      return null;
    }

    if (existing.backingDatasetId) {
      throw new DerivedDatasetMutationError(
        "Derived dataset views do not have upload history to revert.",
      );
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

  if (!reverted) {
    return null;
  }

  await refreshDerivedDatasetsForSource(reverted.dataset.id);

  return reverted;
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

    const [dependentDerivedView] = await tx
      .select({ id: datasets.id })
      .from(datasets)
      .where(eq(datasets.backingDatasetId, datasetId))
      .limit(1);

    if (dependentDerivedView) {
      throw new DatasetDeleteConflictError();
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
  const dataset = await getDatasetRecord(input.datasetId);

  if (!dataset) {
    return null;
  }

  if (dataset.backingDatasetId) {
    throw new DerivedDatasetMutationError(
      "Derived dataset views cannot store their own dataset rows.",
    );
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

  const summary = toDatasetSummary(updated);

  if (input.isFinalBatch) {
    await refreshDerivedDatasetsForSource(summary.id);
  }

  return summary;
}

export async function getDatasetRows(input: {
  datasetId: string;
  page: number;
  pageSize: number;
  filter?: string;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  includeDisabled?: boolean;
}) {
  const datasetRecord = await getAccessibleDatasetRecord({
    datasetId: input.datasetId,
    includeDisabled: input.includeDisabled,
  });

  if (!datasetRecord) {
    return null;
  }

  const resolved = await resolveDatasetSourceRecord({
    dataset: datasetRecord,
  });

  if (!resolved) {
    return null;
  }

  const dataset = toDatasetSummary(resolved.dataset);
  const sourceDatasetId = resolved.sourceDataset.id;

  const page = Math.max(input.page, 1);
  const pageSize = Math.min(Math.max(input.pageSize, 1), 1000);
  const offset = (page - 1) * pageSize;
  const predicates: SQL[] = [eq(datasetRows.datasetId, sourceDatasetId)];

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
    sourceDatasetId,
    rows,
    page,
    pageSize,
    totalRows,
    pageCount: Math.max(1, Math.ceil(totalRows / pageSize)),
  };
}

export async function getAllDatasetRows(input: {
  datasetId: string;
  includeDisabled?: boolean;
}) {
  const datasetRecord = await getAccessibleDatasetRecord({
    datasetId: input.datasetId,
    includeDisabled: input.includeDisabled,
  });

  if (!datasetRecord) {
    return null;
  }

  const resolved = await resolveDatasetSourceRecord({
    dataset: datasetRecord,
  });

  if (!resolved) {
    return null;
  }

  const sourceDatasetId = resolved.sourceDataset.id;

  const rows = await getDb()
    .select({
      id: datasetRows.id,
      rowIndex: datasetRows.rowIndex,
      data: datasetRows.data,
    })
    .from(datasetRows)
    .where(eq(datasetRows.datasetId, sourceDatasetId))
    .orderBy(asc(datasetRows.rowIndex));

  return {
    sourceDatasetId,
    rows,
    page: 1,
    pageSize: rows.length,
    totalRows: rows.length,
    pageCount: 1,
  };
}
