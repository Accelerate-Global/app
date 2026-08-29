import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import {
  dataArchivePackages,
  dataArchiveRehydrations,
} from "@/db/schema";
import type { DataArchiveState, DataArchiveSummary } from "@/lib/api-types";

import type { ArchivePackage } from "./canonical";

export class DataArchiveRehydrationRequiredError extends Error {
  readonly status = 409;
  readonly code = "archive-rehydration-required";

  constructor(
    message = "This historical payload is in cold storage and requires operator rehydration before use.",
  ) {
    super(message);
    this.name = "DataArchiveRehydrationRequiredError";
  }
}

function iso(value: Date | string | null): string | null {
  return value ? new Date(value).toISOString() : null;
}

function state(status: typeof dataArchivePackages.$inferSelect.status): DataArchiveState {
  if (status === "cold") return "cold";
  if (status === "rehydrating") return "rehydrating";
  if (status === "failed") return "failed";
  return "hot";
}

function summary(row: typeof dataArchivePackages.$inferSelect): DataArchiveSummary {
  return {
    state: state(row.status),
    packageKey: row.packageKey,
    sourceChecksum: row.sourceChecksum,
    rowCount: row.rowCount,
    objectCount: row.objectCount,
    sizeBytes: row.sizeBytes,
    integrityVerifiedAt: new Date(row.integrityVerifiedAt).toISOString(),
    restoreVerifiedAt: iso(row.restoreVerifiedAt),
    rehydratedAt: iso(row.rehydratedAt),
  };
}

export async function getArchiveSummaries(input: {
  packageKind: ArchivePackage["packageKind"];
  sourceIdentifiers: string[];
}): Promise<Map<string, DataArchiveSummary>> {
  if (input.sourceIdentifiers.length === 0) return new Map();
  const rows = await getDb()
    .select()
    .from(dataArchivePackages)
    .where(
      and(
        eq(dataArchivePackages.packageKind, input.packageKind),
        inArray(dataArchivePackages.sourceIdentifier, input.sourceIdentifiers),
      ),
    )
    .orderBy(desc(dataArchivePackages.sourceCreatedAt), desc(dataArchivePackages.createdAt));
  const result = new Map<string, DataArchiveSummary>();
  for (const row of rows) {
    if (!result.has(row.sourceIdentifier)) result.set(row.sourceIdentifier, summary(row));
  }
  return result;
}

export async function assertArchiveSourceUsable(input: {
  packageKind: ArchivePackage["packageKind"];
  sourceIdentifier: string;
}): Promise<void> {
  const [archivePackage] = await getDb()
    .select()
    .from(dataArchivePackages)
    .where(
      and(
        eq(dataArchivePackages.packageKind, input.packageKind),
        eq(dataArchivePackages.sourceIdentifier, input.sourceIdentifier),
      ),
    )
    .orderBy(desc(dataArchivePackages.sourceCreatedAt), desc(dataArchivePackages.createdAt))
    .limit(1);
  if (!archivePackage || archivePackage.status === "verified") return;
  if (archivePackage.status !== "rehydrated") {
    throw new DataArchiveRehydrationRequiredError();
  }
  const [verifiedRehydration] = await getDb()
    .select({ id: dataArchiveRehydrations.id })
    .from(dataArchiveRehydrations)
    .where(
      and(
        eq(dataArchiveRehydrations.packageId, archivePackage.id),
        eq(dataArchiveRehydrations.status, "verified"),
        eq(dataArchiveRehydrations.manifestChecksum, archivePackage.manifestChecksum),
      ),
    )
    .limit(1);
  assertArchiveRecordUsable({
    status: archivePackage.status,
    verifiedRehydration: Boolean(verifiedRehydration),
  });
}

export function assertArchiveRecordUsable(input: {
  status: typeof dataArchivePackages.$inferSelect.status | null;
  verifiedRehydration: boolean;
}): void {
  if (input.status === null || input.status === "verified") return;
  if (input.status !== "rehydrated" || !input.verifiedRehydration) {
    throw new DataArchiveRehydrationRequiredError();
  }
}

export function archiveStateAllowsImmediateUse(
  archive: DataArchiveSummary | null | undefined,
): boolean {
  return !archive || archive.state === "hot";
}
