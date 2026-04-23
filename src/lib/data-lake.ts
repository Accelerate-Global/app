import { and, asc, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { datasets } from "@/db/schema";
import type { DataLakeSource } from "@/lib/api-types";

type DataLakeAccessOptions = {
  includeDisabled?: boolean;
};

type DataLakeDatasetRecord = typeof datasets.$inferSelect;

function toDataLakeSource(row: DataLakeDatasetRecord): DataLakeSource {
  const sourceOrganizationName = row.sourceOrganizationName?.trim() || null;

  return {
    datasetId: row.id,
    displayName: sourceOrganizationName ?? row.fileName,
    sourceOrganizationName,
    datasetFileName: row.fileName,
    lastUploadAt: row.currentVersionCreatedAt.toISOString(),
    status: row.status,
    rowCount: row.rowCount,
    isPublic: row.isPublic,
  };
}

export async function listDataLakeSources(
  options: DataLakeAccessOptions = {},
) {
  const predicates = [sql`${datasets.backingDatasetId} is null`];

  if (!options.includeDisabled) {
    predicates.push(eq(datasets.isPublic, true));
  }

  const rows = await getDb()
    .select()
    .from(datasets)
    .where(and(...predicates))
    .orderBy(desc(datasets.currentVersionCreatedAt), asc(datasets.fileName));

  return rows.map(toDataLakeSource);
}
