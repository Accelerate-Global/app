import { Buffer } from "node:buffer";

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  datasetRows,
  datasets,
  partnerExportProfileColumns,
  partnerExportProfiles,
  partnerExportRuns,
} from "@/db/schema";
import type { CurrentIdentity } from "@/lib/auth";
import { sanitizeFileName } from "@/lib/csv";
import { logError } from "@/lib/error-logging";

import { getPartnerExportDownloadFileName } from "./download-file-name";
import {
  buildPartnerExportPreview,
  getPartnerExportCrosswalk,
  hasBlockingPartnerExportErrors,
  hasPartnerExportWarnings,
  serializePartnerExportCsv,
  transformPartnerExportRows,
  validateProfileColumns,
} from "./engine";
import {
  checksumPartnerExportArtifact,
  fingerprintPartnerExportRows,
  fingerprintPartnerExportSchema,
} from "./fingerprint";
import {
  deletePartnerExportArtifacts,
  downloadPartnerExportArtifact,
  uploadPartnerExportArtifact,
} from "./storage";
import {
  PARTNER_EXPORT_MAX_ROWS,
  PartnerExportError,
  type PartnerExportArtifactKind,
  type PartnerExportProfile,
  type PartnerExportProfileInput,
  type PartnerExportProfileRevision,
  type PartnerExportRun,
  type PartnerExportSourceSnapshot,
} from "./types";

type PartnerExportProfileRecord = typeof partnerExportProfiles.$inferSelect;
type PartnerExportProfileColumnRecord =
  typeof partnerExportProfileColumns.$inferSelect;
type PartnerExportRunRecord = typeof partnerExportRuns.$inferSelect;
type DatasetRecord = typeof datasets.$inferSelect;
type SourceRow = {
  rowIndex: number;
  data: Record<string, string>;
};

function toProfileColumn(row: PartnerExportProfileColumnRecord) {
  return {
    id: row.id,
    ordinal: row.ordinal,
    outputHeader: row.outputHeader,
    sourceColumnKeys: row.sourceColumnKeys,
    sourceLabelSnapshot: row.sourceLabelSnapshot,
    transform: row.transform,
    literalValue: row.literalValue,
    required: row.required,
    requiredSeverity: row.requiredSeverity,
  };
}

function toProfile(
  row: PartnerExportProfileRecord,
  columns: PartnerExportProfileColumnRecord[],
): PartnerExportProfile {
  return {
    id: row.id,
    datasetId: row.datasetId,
    name: row.name,
    partnerKey: row.partnerKey,
    status: row.status,
    fileNameStem: row.fileNameStem,
    revision: row.revision,
    columns: columns.map(toProfileColumn),
    createdByOwnerId: row.createdByOwnerId,
    updatedByOwnerId: row.updatedByOwnerId,
    archivedByOwnerId: row.archivedByOwnerId,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toProfileRevision(profile: PartnerExportProfile): PartnerExportProfileRevision {
  return {
    id: profile.id,
    datasetId: profile.datasetId,
    name: profile.name,
    partnerKey: profile.partnerKey,
    fileNameStem: profile.fileNameStem,
    revision: profile.revision,
    columns: profile.columns,
  };
}

function toRun(row: PartnerExportRunRecord): PartnerExportRun {
  return {
    id: row.id,
    profileId: row.profileId,
    datasetId: row.datasetId,
    actorOwnerId: row.actorOwnerId,
    actorEmail: row.actorEmail,
    status: row.status,
    warningsAcknowledged: row.warningsAcknowledged,
    profileRevision: row.profileRevision,
    sourceSnapshot: row.sourceSnapshot,
    validation: row.validation,
    rowCount: row.rowCount,
    outputChecksum: row.outputChecksum,
    outputSizeBytes: row.outputSizeBytes,
    csvStoragePath: row.csvStoragePath,
    crosswalkStoragePath: row.crosswalkStoragePath,
    validationStoragePath: row.validationStoragePath,
    errorMessage: row.errorMessage,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function getSourceDatasetRecord(datasetId: string) {
  const [dataset] = await getDb()
    .select()
    .from(datasets)
    .where(eq(datasets.id, datasetId))
    .limit(1);

  if (!dataset) {
    return null;
  }

  if (!dataset.backingDatasetId) {
    return dataset;
  }

  const [sourceDataset] = await getDb()
    .select()
    .from(datasets)
    .where(eq(datasets.id, dataset.backingDatasetId))
    .limit(1);

  return sourceDataset ?? null;
}

async function getSourceRows(datasetId: string): Promise<SourceRow[]> {
  return getDb()
    .select({
      rowIndex: datasetRows.rowIndex,
      data: datasetRows.data,
    })
    .from(datasetRows)
    .where(eq(datasetRows.datasetId, datasetId))
    .orderBy(asc(datasetRows.rowIndex));
}

async function loadSourceSnapshot(datasetId: string) {
  const dataset = await getSourceDatasetRecord(datasetId);

  if (!dataset) {
    throw new PartnerExportError("Source dataset not found.", 404);
  }

  if (dataset.status !== "ready") {
    throw new PartnerExportError("Source dataset is not ready for export.", 409);
  }

  if (dataset.rowCount > PARTNER_EXPORT_MAX_ROWS) {
    throw new PartnerExportError(
      `Partner exports are limited to ${PARTNER_EXPORT_MAX_ROWS.toLocaleString()} rows.`,
      413,
    );
  }

  const rows = await getSourceRows(dataset.id);
  const snapshot: PartnerExportSourceSnapshot = {
    datasetId: dataset.id,
    blobPath: dataset.blobPath,
    currentVersionCreatedAt: dataset.currentVersionCreatedAt.toISOString(),
    rowCount: rows.length,
    columns: dataset.columns,
    schemaFingerprint: fingerprintPartnerExportSchema(dataset.columns),
    contentFingerprint: fingerprintPartnerExportRows(rows),
  };

  return { dataset, rows, snapshot };
}

async function hydrateProfiles(rows: PartnerExportProfileRecord[]) {
  if (rows.length === 0) {
    return [];
  }

  const columns = await getDb()
    .select()
    .from(partnerExportProfileColumns)
    .where(
      inArray(
        partnerExportProfileColumns.profileId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(
      asc(partnerExportProfileColumns.profileId),
      asc(partnerExportProfileColumns.ordinal),
    );
  const columnsByProfile = new Map<string, PartnerExportProfileColumnRecord[]>();

  for (const column of columns) {
    columnsByProfile.set(column.profileId, [
      ...(columnsByProfile.get(column.profileId) ?? []),
      column,
    ]);
  }

  return rows.map((row) => toProfile(row, columnsByProfile.get(row.id) ?? []));
}

async function getActiveProfile(input: { datasetId: string; profileId: string }) {
  const [record] = await getDb()
    .select()
    .from(partnerExportProfiles)
    .where(
      and(
        eq(partnerExportProfiles.id, input.profileId),
        eq(partnerExportProfiles.datasetId, input.datasetId),
        isNull(partnerExportProfiles.archivedAt),
      ),
    )
    .limit(1);

  if (!record) {
    return null;
  }

  return (await hydrateProfiles([record]))[0] ?? null;
}

function normalizeProfileInput(input: PartnerExportProfileInput) {
  const fileName = sanitizeFileName(input.fileNameStem.replace(/\.csv$/iu, ""));
  return {
    ...input,
    name: input.name.trim(),
    fileNameStem: fileName.replace(/\.csv$/iu, "") || "partner-export",
    columns: input.columns.map((column) => ({
      ...column,
      outputHeader: column.outputHeader.trim(),
      literalValue: column.literalValue?.trim() || null,
    })),
  };
}

function assertProfileInput(input: {
  profile: PartnerExportProfileInput;
  dataset: DatasetRecord;
}) {
  const errors = validateProfileColumns({
    columns: input.profile.columns,
    sourceColumns: input.dataset.columns,
    partnerKey: input.profile.partnerKey,
  });

  if (errors.length > 0) {
    throw new PartnerExportError(errors[0]);
  }
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export async function listPartnerExports(datasetId: string) {
  const source = await getSourceDatasetRecord(datasetId);
  if (!source) {
    return null;
  }

  const [profileRows, runRows] = await Promise.all([
    getDb()
      .select()
      .from(partnerExportProfiles)
      .where(
        and(
          eq(partnerExportProfiles.datasetId, source.id),
          isNull(partnerExportProfiles.archivedAt),
        ),
      )
      .orderBy(desc(partnerExportProfiles.updatedAt)),
    getDb()
      .select()
      .from(partnerExportRuns)
      .where(eq(partnerExportRuns.datasetId, source.id))
      .orderBy(desc(partnerExportRuns.createdAt))
      .limit(50),
  ]);

  return {
    profiles: await hydrateProfiles(profileRows),
    runs: runRows.map(toRun),
  };
}

export async function createPartnerExportProfile(input: {
  datasetId: string;
  identity: CurrentIdentity;
  profile: PartnerExportProfileInput;
}) {
  const dataset = await getSourceDatasetRecord(input.datasetId);
  if (!dataset) {
    return null;
  }

  const normalized = normalizeProfileInput(input.profile);
  assertProfileInput({ profile: normalized, dataset });

  try {
    const profileId = await getDb().transaction(async (tx) => {
      const [profile] = await tx
        .insert(partnerExportProfiles)
        .values({
          datasetId: dataset.id,
          name: normalized.name,
          partnerKey: normalized.partnerKey,
          fileNameStem: normalized.fileNameStem,
          createdByOwnerId: input.identity.ownerId,
          updatedByOwnerId: input.identity.ownerId,
        })
        .returning();

      await tx.insert(partnerExportProfileColumns).values(
        normalized.columns.map((column, ordinal) => ({
          profileId: profile.id,
          ordinal,
          ...column,
        })),
      );

      return profile.id;
    });

    return getActiveProfile({ datasetId: dataset.id, profileId });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new PartnerExportError(
        "An active export profile with this name already exists.",
        409,
      );
    }
    throw error;
  }
}

export async function updatePartnerExportProfile(input: {
  datasetId: string;
  profileId: string;
  identity: CurrentIdentity;
  profile: PartnerExportProfileInput;
}) {
  const [dataset, existing] = await Promise.all([
    getSourceDatasetRecord(input.datasetId),
    getActiveProfile({ datasetId: input.datasetId, profileId: input.profileId }),
  ]);
  if (!dataset || !existing) {
    return null;
  }

  const normalized = normalizeProfileInput(input.profile);
  assertProfileInput({ profile: normalized, dataset });

  try {
    await getDb().transaction(async (tx) => {
      await tx
        .update(partnerExportProfiles)
        .set({
          name: normalized.name,
          partnerKey: normalized.partnerKey,
          fileNameStem: normalized.fileNameStem,
          revision: sql`${partnerExportProfiles.revision} + 1`,
          updatedByOwnerId: input.identity.ownerId,
          updatedAt: new Date(),
        })
        .where(eq(partnerExportProfiles.id, existing.id));
      await tx
        .delete(partnerExportProfileColumns)
        .where(eq(partnerExportProfileColumns.profileId, existing.id));
      await tx.insert(partnerExportProfileColumns).values(
        normalized.columns.map((column, ordinal) => ({
          profileId: existing.id,
          ordinal,
          ...column,
        })),
      );
    });

    return getActiveProfile({ datasetId: dataset.id, profileId: existing.id });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new PartnerExportError(
        "An active export profile with this name already exists.",
        409,
      );
    }
    throw error;
  }
}

export async function archivePartnerExportProfile(input: {
  datasetId: string;
  profileId: string;
  identity: CurrentIdentity;
}) {
  const source = await getSourceDatasetRecord(input.datasetId);
  if (!source) {
    return null;
  }

  const [archived] = await getDb()
    .update(partnerExportProfiles)
    .set({
      status: "archived",
      archivedAt: new Date(),
      archivedByOwnerId: input.identity.ownerId,
      updatedByOwnerId: input.identity.ownerId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(partnerExportProfiles.id, input.profileId),
        eq(partnerExportProfiles.datasetId, source.id),
        isNull(partnerExportProfiles.archivedAt),
      ),
    )
    .returning();

  return archived ? toProfile(archived, []) : null;
}

export async function previewPartnerExportProfile(input: {
  datasetId: string;
  profileId: string;
}) {
  const source = await getSourceDatasetRecord(input.datasetId);
  if (!source) {
    return null;
  }
  const profile = await getActiveProfile({
    datasetId: source.id,
    profileId: input.profileId,
  });
  if (!profile) {
    return null;
  }

  const { rows, snapshot } = await loadSourceSnapshot(source.id);
  return {
    preview: buildPartnerExportPreview({
      rows,
      profile: toProfileRevision(profile),
      sourceColumns: snapshot.columns,
    }),
    snapshot,
  };
}

export async function startPartnerExportRun(input: {
  datasetId: string;
  profileId: string;
  identity: CurrentIdentity;
  warningsAcknowledged: boolean;
}) {
  const source = await getSourceDatasetRecord(input.datasetId);
  if (!source) {
    return null;
  }
  const profile = await getActiveProfile({
    datasetId: source.id,
    profileId: input.profileId,
  });
  if (!profile) {
    return null;
  }

  const { rows, snapshot } = await loadSourceSnapshot(source.id);
  const revision = toProfileRevision(profile);
  const transformed = transformPartnerExportRows({
    rows,
    profile: revision,
    sourceColumns: snapshot.columns,
  });

  if (hasBlockingPartnerExportErrors(transformed.validation)) {
    throw new PartnerExportError(
      "Resolve blocking validation errors before generating this export.",
      409,
    );
  }
  if (
    hasPartnerExportWarnings(transformed.validation) &&
    !input.warningsAcknowledged
  ) {
    throw new PartnerExportError(
      "Acknowledge the current validation warnings before generating this export.",
      409,
    );
  }

  const [run] = await getDb()
    .insert(partnerExportRuns)
    .values({
      profileId: profile.id,
      datasetId: source.id,
      actorOwnerId: input.identity.ownerId,
      actorEmail: input.identity.email,
      status: "queued",
      warningsAcknowledged: input.warningsAcknowledged,
      profileRevision: revision,
      sourceSnapshot: snapshot,
      validation: transformed.validation,
    })
    .returning();

  return toRun(run);
}

export async function executePartnerExportRun(input: { runId: string }) {
  const startedAt = new Date();
  const [run] = await getDb()
    .update(partnerExportRuns)
    .set({ status: "running", startedAt })
    .where(
      and(
        eq(partnerExportRuns.id, input.runId),
        eq(partnerExportRuns.status, "queued"),
      ),
    )
    .returning();

  if (!run) {
    return null;
  }

  const uploadedPaths: string[] = [];
  try {
    const { rows, snapshot } = await loadSourceSnapshot(run.datasetId);
    if (
      snapshot.schemaFingerprint !== run.sourceSnapshot.schemaFingerprint ||
      snapshot.contentFingerprint !== run.sourceSnapshot.contentFingerprint
    ) {
      throw new PartnerExportError(
        "The source dataset changed after this export was queued. Start a new run.",
        409,
      );
    }

    const transformed = transformPartnerExportRows({
      rows,
      profile: run.profileRevision,
      sourceColumns: run.sourceSnapshot.columns,
    });
    if (hasBlockingPartnerExportErrors(transformed.validation)) {
      throw new PartnerExportError(
        "Blocking validation errors prevented export generation.",
        409,
      );
    }
    if (
      hasPartnerExportWarnings(transformed.validation) &&
      !run.warningsAcknowledged
    ) {
      throw new PartnerExportError(
        "Validation warnings were not acknowledged.",
        409,
      );
    }

    const headers = run.profileRevision.columns.map(
      (column) => column.outputHeader,
    );
    const csv = serializePartnerExportCsv({ rows: transformed.rows, headers });
    const crosswalk = JSON.stringify(
      {
        profile: run.profileRevision,
        source: run.sourceSnapshot,
        crosswalk: getPartnerExportCrosswalk(run.profileRevision.columns),
      },
      null,
      2,
    );
    const validation = JSON.stringify(transformed.validation, null, 2);
    const csvFileName = `${run.profileRevision.fileNameStem}.csv`;

    const csvStoragePath = await uploadPartnerExportArtifact({
      runId: run.id,
      kind: "csv",
      csvFileName,
      body: csv,
    });
    uploadedPaths.push(csvStoragePath);
    const crosswalkStoragePath = await uploadPartnerExportArtifact({
      runId: run.id,
      kind: "crosswalk",
      csvFileName,
      body: crosswalk,
    });
    uploadedPaths.push(crosswalkStoragePath);
    const validationStoragePath = await uploadPartnerExportArtifact({
      runId: run.id,
      kind: "validation",
      csvFileName,
      body: validation,
    });
    uploadedPaths.push(validationStoragePath);

    const [completed] = await getDb()
      .update(partnerExportRuns)
      .set({
        status: "success",
        validation: transformed.validation,
        rowCount: transformed.rows.length,
        outputChecksum: checksumPartnerExportArtifact(csv),
        outputSizeBytes: Buffer.byteLength(csv, "utf8"),
        csvStoragePath,
        crosswalkStoragePath,
        validationStoragePath,
        errorMessage: null,
        completedAt: new Date(),
      })
      .where(eq(partnerExportRuns.id, run.id))
      .returning();

    return toRun(completed);
  } catch (error) {
    if (uploadedPaths.length > 0) {
      try {
        await deletePartnerExportArtifacts(uploadedPaths);
      } catch (cleanupError) {
        logError("Failed to clean up partner export artifacts", cleanupError);
      }
    }

    const message =
      error instanceof PartnerExportError
        ? error.message
        : "Partner export generation failed.";
    if (!(error instanceof PartnerExportError)) {
      logError("Failed to generate partner export", error);
    }

    const [failed] = await getDb()
      .update(partnerExportRuns)
      .set({
        status: "failed",
        errorMessage: message,
        completedAt: new Date(),
      })
      .where(eq(partnerExportRuns.id, run.id))
      .returning();

    return toRun(failed);
  }
}

export async function getPartnerExportRun(input: {
  datasetId: string;
  runId: string;
}) {
  const source = await getSourceDatasetRecord(input.datasetId);
  if (!source) {
    return null;
  }

  const [run] = await getDb()
    .select()
    .from(partnerExportRuns)
    .where(
      and(
        eq(partnerExportRuns.id, input.runId),
        eq(partnerExportRuns.datasetId, source.id),
      ),
    )
    .limit(1);

  return run ? toRun(run) : null;
}

export async function getPartnerExportArtifactDownload(input: {
  datasetId: string;
  runId: string;
  kind: PartnerExportArtifactKind;
}) {
  const run = await getPartnerExportRun(input);
  if (!run || run.status !== "success") {
    return null;
  }

  const source = await getSourceDatasetRecord(input.datasetId);
  if (!source) {
    return null;
  }

  const path =
    input.kind === "csv"
      ? run.csvStoragePath
      : input.kind === "crosswalk"
        ? run.crosswalkStoragePath
        : run.validationStoragePath;
  if (!path) {
    return null;
  }

  const body = await downloadPartnerExportArtifact(path);
  if (!body) {
    return null;
  }

  return {
    body,
    contentType: input.kind === "csv" ? "text/csv" : "application/json",
    fileName: getPartnerExportDownloadFileName({
      datasetName: source.fileName,
      profileFileNameStem: run.profileRevision.fileNameStem,
      kind: input.kind,
      downloadedAt: new Date(),
    }),
  };
}

export { PartnerExportError } from "./types";
export type { PartnerExportProfileInput } from "./types";
