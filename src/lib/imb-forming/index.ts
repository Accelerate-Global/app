import { Buffer } from "node:buffer";

import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import {
  apiConnectionRunOutputs,
  apiConnectionRuns,
  apiConnections,
  datasetFormingFindings,
  datasetFormingRuns,
} from "@/db/schema";
import {
  checksumApiConnectionArtifact,
  parseApiConnectionRowsArtifact,
  serializeApiConnectionRowsArtifact,
  serializeApiConnectionRowsToCsv,
} from "@/lib/api-connection-output";
import type { CurrentIdentity } from "@/lib/auth";
import { chunkRows } from "@/lib/csv";
import {
  createDataset,
  insertDatasetRowBatch,
  replaceDatasetContents,
} from "@/lib/datasets";
import {
  createDatasetStoragePath,
  getApiConnectionRunArtifactReadBuckets,
  getDatasetStorageBucket,
} from "@/lib/dataset-storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import {
  formImbRows,
  getImbFieldContractChecksum,
  getImbTransformationChecksum,
} from "./engine";
import {
  IMB_FIELD_CONTRACT_VERSION,
  IMB_FORMING_TRANSFORMATION_VERSION,
} from "./field-contract";
import {
  assertEligibleImbSource,
  assertPublishableImbCandidate,
  isStaleImbBuild,
} from "./policy";
import {
  loadImbFormingResourceBinding,
  loadImbFormingResources,
} from "./resources";
import {
  deleteImbFormingArtifacts,
  readImbFormingArtifact,
  uploadImbFormingArtifact,
} from "./storage";
import type {
  ImbFormingArtifactKind,
  ImbFormingArtifactManifest,
  ImbFormingDecisionInput,
  ImbFormingFinding,
  ImbFormingLineageManifest,
  ImbFormingRun,
  ImbFormingValidationSummary,
} from "./types";
import { ImbFormingError } from "./types";

const FINDING_PREVIEW_LIMIT = 250;
const EMPTY_VALIDATION: ImbFormingValidationSummary = {
  warningCount: 0,
  errorCount: 0,
  unresolvedCountryRows: 0,
  unresolvedRopRows: 0,
  countryConflictRows: 0,
  ropParentConflictRows: 0,
  invalidValueCount: 0,
  schemaDriftFields: [],
};

type FormingRunRecord = typeof datasetFormingRuns.$inferSelect;

function parseLineageManifest(body: string) {
  const parsed = JSON.parse(body) as Partial<ImbFormingLineageManifest>;
  if (parsed.schemaVersion !== 1 || !parsed.resourceBinding) {
    throw new Error("The candidate lineage manifest is invalid.");
  }
  return parsed as ImbFormingLineageManifest;
}

function assertLineageMatchesRun(input: {
  row: FormingRunRecord;
  lineage: ImbFormingLineageManifest;
  resourceBinding: ImbFormingLineageManifest["resourceBinding"];
}) {
  const { row, lineage, resourceBinding } = input;
  const matches =
    lineage.connectionId === row.connectionId &&
    lineage.sourceRunId === row.sourceRunId &&
    lineage.sourceRowsChecksum === row.sourceRowsChecksum &&
    lineage.sourceRawChecksum === row.sourceRawChecksum &&
    lineage.resourceBinding.resourceSetId === row.resourceSetId &&
    lineage.resourceBinding.resourceSetChecksum === resourceBinding.resourceSetChecksum &&
    lineage.resourceBinding.countryVersionId === resourceBinding.countryVersionId &&
    lineage.resourceBinding.ropVersionId === resourceBinding.ropVersionId &&
    lineage.fieldContractVersion === row.fieldContractVersion &&
    lineage.fieldContractChecksum === row.fieldContractChecksum &&
    lineage.transformationVersion === row.transformationVersion &&
    lineage.transformationChecksum === row.transformationChecksum &&
    lineage.inputRowCount === row.inputRowCount &&
    lineage.outputRowCount === row.outputRowCount &&
    lineage.outputChecksum === row.outputChecksum;
  if (!matches) {
    throw new Error("The candidate lineage manifest no longer matches its bindings.");
  }
}

async function readSourceArtifact(path: string) {
  const supabase = createSupabaseAdminClient();
  for (const bucket of getApiConnectionRunArtifactReadBuckets()) {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (!error && data) return data.text();
    if (error?.status !== 404) throw error;
  }
  throw new ImbFormingError("The archived IMB source artifact was not found.", 404);
}

function toFinding(row: typeof datasetFormingFindings.$inferSelect): ImbFormingFinding {
  return {
    severity: row.severity,
    ruleCode: row.ruleCode,
    sourceRowIndex: row.sourceRowIndex,
    stableRowKey: row.stableRowKey,
    fieldName: row.fieldName,
    sourceValue: row.sourceValue,
    canonicalValue: row.canonicalValue,
    message: row.message,
    details: row.details,
  };
}

async function hydrateFormingRun(row: FormingRunRecord): Promise<ImbFormingRun> {
  const [findingRows, resourceBinding] = await Promise.all([
    getDb()
      .select()
      .from(datasetFormingFindings)
      .where(eq(datasetFormingFindings.formingRunId, row.id))
      .orderBy(asc(datasetFormingFindings.id))
      .limit(FINDING_PREVIEW_LIMIT + 1),
    loadImbFormingResourceBinding(row.resourceSetId),
  ]);
  const findingsTruncated = findingRows.length > FINDING_PREVIEW_LIMIT;

  return {
    id: row.id,
    connectionId: row.connectionId,
    sourceRunId: row.sourceRunId,
    resourceSetId: row.resourceSetId,
    resourceSetChecksum: resourceBinding.resourceSetChecksum,
    countryVersionId: resourceBinding.countryVersionId,
    ropVersionId: resourceBinding.ropVersionId,
    actorOwnerId: row.actorOwnerId,
    actorEmail: row.actorEmail,
    status: row.status,
    sourceRowsChecksum: row.sourceRowsChecksum,
    sourceRawChecksum: row.sourceRawChecksum,
    fieldContractVersion: row.fieldContractVersion,
    fieldContractChecksum: row.fieldContractChecksum,
    transformationVersion: row.transformationVersion,
    transformationChecksum: row.transformationChecksum,
    inputRowCount: row.inputRowCount,
    outputRowCount: row.outputRowCount,
    warningCount: row.warningCount,
    errorCount: row.errorCount,
    validationSummary: row.validationSummary,
    artifactManifest: row.artifactManifest,
    outputChecksum: row.outputChecksum,
    outputSizeBytes: row.outputSizeBytes,
    datasetId: row.datasetId,
    rejectionReason: row.rejectionReason,
    rejectedByOwnerId: row.rejectedByOwnerId,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    publicationReason: row.publicationReason,
    warningsAcknowledged: row.warningsAcknowledged,
    publishedByOwnerId: row.publishedByOwnerId,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    errorMessage: row.errorMessage,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    findings: findingRows.slice(0, FINDING_PREVIEW_LIMIT).map(toFinding),
    findingsTruncated,
  };
}

async function getFormingRunRecord(input: {
  connectionId: string;
  sourceRunId: string;
  formingRunId: string;
}) {
  const [row] = await getDb()
    .select()
    .from(datasetFormingRuns)
    .where(
      and(
        eq(datasetFormingRuns.id, input.formingRunId),
        eq(datasetFormingRuns.connectionId, input.connectionId),
        eq(datasetFormingRuns.sourceRunId, input.sourceRunId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listImbFormingRuns(input: {
  connectionId: string;
  sourceRunId: string;
}) {
  const rows = await getDb()
    .select()
    .from(datasetFormingRuns)
    .where(
      and(
        eq(datasetFormingRuns.connectionId, input.connectionId),
        eq(datasetFormingRuns.sourceRunId, input.sourceRunId),
      ),
    )
    .orderBy(desc(datasetFormingRuns.createdAt))
    .limit(25);
  return Promise.all(rows.map(hydrateFormingRun));
}

export async function getImbFormingRun(input: {
  connectionId: string;
  sourceRunId: string;
  formingRunId: string;
}) {
  const row = await getFormingRunRecord(input);
  return row ? hydrateFormingRun(row) : null;
}

export async function startImbFormingRun(input: {
  connectionId: string;
  sourceRunId: string;
  identity: CurrentIdentity;
}) {
  const [source] = await getDb()
    .select({ run: apiConnectionRuns, output: apiConnectionRunOutputs })
    .from(apiConnectionRuns)
    .innerJoin(
      apiConnectionRunOutputs,
      eq(apiConnectionRunOutputs.runId, apiConnectionRuns.id),
    )
    .where(
      and(
        eq(apiConnectionRuns.id, input.sourceRunId),
        eq(apiConnectionRuns.connectionId, input.connectionId),
      ),
    )
    .limit(1);

  if (!source) throw new ImbFormingError("A successful IMB ingestion run is required.", 409);
  assertEligibleImbSource({
    connectionId: input.connectionId,
    status: source.run.status,
    mode: source.run.mode,
    rowsChecksum: source.output.rowsChecksum,
    rawChecksum: source.output.rawChecksum,
  });

  const resources = await loadImbFormingResources();
  const transformationChecksum = getImbTransformationChecksum();
  const [existing] = await getDb()
    .select()
    .from(datasetFormingRuns)
    .where(
      and(
        eq(datasetFormingRuns.sourceRunId, input.sourceRunId),
        eq(datasetFormingRuns.resourceSetId, resources.binding.resourceSetId),
        eq(datasetFormingRuns.transformationChecksum, transformationChecksum),
        inArray(datasetFormingRuns.status, ["building", "valid", "publishing"]),
      ),
    )
    .orderBy(desc(datasetFormingRuns.createdAt))
    .limit(1);
  if (
    existing?.status === "building" &&
    isStaleImbBuild(existing.createdAt)
  ) {
    await getDb()
      .update(datasetFormingRuns)
      .set({
        status: "failed",
        errorMessage: "The background build did not complete and was superseded.",
        completedAt: new Date(),
      })
      .where(
        and(
          eq(datasetFormingRuns.id, existing.id),
          eq(datasetFormingRuns.status, "building"),
        ),
      );
  } else if (existing) {
    throw new ImbFormingError(
      "A current candidate already exists for this run and resource set.",
      409,
    );
  }

  try {
    const [row] = await getDb()
      .insert(datasetFormingRuns)
      .values({
        connectionId: input.connectionId,
        sourceRunId: input.sourceRunId,
        resourceSetId: resources.binding.resourceSetId,
        actorOwnerId: input.identity.ownerId,
        actorEmail: input.identity.email,
        status: "building",
        sourceRowsChecksum: source.output.rowsChecksum!,
        sourceRawChecksum: source.output.rawChecksum!,
        fieldContractVersion: IMB_FIELD_CONTRACT_VERSION,
        fieldContractChecksum: getImbFieldContractChecksum(),
        transformationVersion: IMB_FORMING_TRANSFORMATION_VERSION,
        transformationChecksum,
        inputRowCount: source.output.rowCount,
        validationSummary: EMPTY_VALIDATION,
        startedAt: new Date(),
      })
      .returning();
    return hydrateFormingRun(row);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      throw new ImbFormingError(
        "A current candidate already exists for this run and resource set.",
        409,
      );
    }
    throw error;
  }
}

async function persistFindings(formingRunId: string, findings: ImbFormingFinding[]) {
  for (const batch of chunkRows(findings)) {
    await getDb().insert(datasetFormingFindings).values(
      batch.map((finding) => ({
        formingRunId,
        ...finding,
      })),
    );
  }
}

export async function executeImbFormingRun(formingRunId: string) {
  const [formingRun] = await getDb()
    .select()
    .from(datasetFormingRuns)
    .where(eq(datasetFormingRuns.id, formingRunId))
    .limit(1);
  if (!formingRun || formingRun.status !== "building") return null;

  const uploadedPaths: string[] = [];
  try {
    const [sourceOutput] = await getDb()
      .select()
      .from(apiConnectionRunOutputs)
      .where(eq(apiConnectionRunOutputs.runId, formingRun.sourceRunId))
      .limit(1);
    if (!sourceOutput) throw new Error("The archived IMB source output is missing.");

    const [rowsBody, rawBody, resources] = await Promise.all([
      readSourceArtifact(sourceOutput.rowsStoragePath),
      readSourceArtifact(sourceOutput.rawStoragePath),
      loadImbFormingResources(formingRun.resourceSetId),
    ]);
    if (checksumApiConnectionArtifact(rowsBody) !== formingRun.sourceRowsChecksum) {
      throw new Error("The archived IMB rows checksum no longer matches its binding.");
    }
    if (checksumApiConnectionArtifact(rawBody) !== formingRun.sourceRawChecksum) {
      throw new Error("The archived IMB raw checksum no longer matches its binding.");
    }
    if (resources.binding.resourceSetId !== formingRun.resourceSetId) {
      throw new Error("The pinned reference resource set could not be loaded.");
    }

    const source = parseApiConnectionRowsArtifact(rowsBody);
    const formed = formImbRows({
      connectionId: formingRun.connectionId,
      sourceRunId: formingRun.sourceRunId,
      columns: source.columns,
      rows: source.rows,
      countries: resources.countries,
      ropEntries: resources.ropEntries,
    });
    const rowsArtifact = serializeApiConnectionRowsArtifact({
      columns: formed.columns,
      rows: formed.rows,
    });
    const findingsArtifact = JSON.stringify(formed.findings, null, 2);
    const csvArtifact = serializeApiConnectionRowsToCsv({
      columns: formed.columns,
      rows: formed.rows,
    });
    const lineage: ImbFormingLineageManifest = {
      schemaVersion: 1,
      connectionId: formingRun.connectionId,
      sourceRunId: formingRun.sourceRunId,
      sourceRowsChecksum: formingRun.sourceRowsChecksum,
      sourceRawChecksum: formingRun.sourceRawChecksum,
      resourceBinding: resources.binding,
      fieldContractVersion: formingRun.fieldContractVersion,
      fieldContractChecksum: formingRun.fieldContractChecksum,
      transformationVersion: formingRun.transformationVersion,
      transformationChecksum: formingRun.transformationChecksum,
      inputRowCount: source.rows.length,
      outputRowCount: formed.rows.length,
      outputChecksum: formed.outputChecksum,
      columns: formed.columns,
      validation: formed.validation,
    };
    const bodies: Record<ImbFormingArtifactKind, string> = {
      rows: rowsArtifact,
      findings: findingsArtifact,
      manifest: JSON.stringify(lineage, null, 2),
      csv: csvArtifact,
    };
    const manifest: ImbFormingArtifactManifest = {};
    for (const kind of ["rows", "findings", "manifest", "csv"] as const) {
      const path = await uploadImbFormingArtifact({
        sourceRunId: formingRun.sourceRunId,
        formingRunId: formingRun.id,
        kind,
        body: bodies[kind],
      });
      uploadedPaths.push(path);
      manifest[kind] = path;
    }

    await persistFindings(formingRun.id, formed.findings);
    const [updated] = await getDb()
      .update(datasetFormingRuns)
      .set({
        status: formed.valid ? "valid" : "invalid",
        inputRowCount: source.rows.length,
        outputRowCount: formed.rows.length,
        warningCount: formed.validation.warningCount,
        errorCount: formed.validation.errorCount,
        validationSummary: formed.validation,
        artifactManifest: manifest,
        outputChecksum: formed.outputChecksum,
        outputSizeBytes: Buffer.byteLength(rowsArtifact),
        completedAt: new Date(),
        errorMessage: null,
      })
      .where(
        and(
          eq(datasetFormingRuns.id, formingRun.id),
          eq(datasetFormingRuns.status, "building"),
        ),
      )
      .returning();
    return updated ? hydrateFormingRun(updated) : null;
  } catch (error) {
    await deleteImbFormingArtifacts(uploadedPaths).catch(() => undefined);
    const message = error instanceof Error ? error.message : "IMB forming failed.";
    const [failed] = await getDb()
      .update(datasetFormingRuns)
      .set({ status: "failed", errorMessage: message, completedAt: new Date() })
      .where(
        and(
          eq(datasetFormingRuns.id, formingRun.id),
          eq(datasetFormingRuns.status, "building"),
        ),
      )
      .returning();
    return failed ? hydrateFormingRun(failed) : null;
  }
}

export async function rejectImbFormingRun(input: {
  connectionId: string;
  sourceRunId: string;
  formingRunId: string;
  identity: CurrentIdentity;
  decision: ImbFormingDecisionInput;
}) {
  const [updated] = await getDb()
    .update(datasetFormingRuns)
    .set({
      status: "rejected",
      rejectionReason: input.decision.reason.trim(),
      rejectedByOwnerId: input.identity.ownerId,
      rejectedAt: new Date(),
    })
    .where(
      and(
        eq(datasetFormingRuns.id, input.formingRunId),
        eq(datasetFormingRuns.connectionId, input.connectionId),
        eq(datasetFormingRuns.sourceRunId, input.sourceRunId),
        inArray(datasetFormingRuns.status, ["valid", "invalid"]),
      ),
    )
    .returning();
  if (!updated) {
    throw new ImbFormingError(
      "Only a valid or invalid undecided candidate can be rejected.",
      409,
    );
  }
  return hydrateFormingRun(updated);
}

async function uploadPublishedDatasetCsv(fileName: string, csv: string) {
  const path = createDatasetStoragePath(fileName);
  const { error } = await createSupabaseAdminClient()
    .storage.from(getDatasetStorageBucket())
    .upload(path, Buffer.from(csv, "utf8"), {
      contentType: "text/csv; charset=utf-8",
      upsert: false,
    });
  if (error) throw error;
  return path;
}

export async function publishImbFormingRun(input: {
  connectionId: string;
  sourceRunId: string;
  formingRunId: string;
  identity: CurrentIdentity;
  decision: ImbFormingDecisionInput;
}) {
  const row = await getFormingRunRecord(input);
  if (!row) throw new ImbFormingError("IMB forming candidate not found.", 404);
  assertPublishableImbCandidate({
    status: row.status,
    warningCount: row.warningCount,
    decision: input.decision,
  });
  const rowsPath = row.artifactManifest.rows;
  const csvPath = row.artifactManifest.csv;
  const findingsPath = row.artifactManifest.findings;
  const manifestPath = row.artifactManifest.manifest;
  if (!rowsPath || !csvPath || !findingsPath || !manifestPath || !row.outputChecksum) {
    throw new ImbFormingError("The candidate artifact package is incomplete.", 409);
  }

  const [connection] = await getDb()
    .select()
    .from(apiConnections)
    .where(eq(apiConnections.id, input.connectionId))
    .limit(1);
  if (!connection) throw new ImbFormingError("IMB connection not found.", 404);

  let publishing: FormingRunRecord | undefined;
  try {
    [publishing] = await getDb()
      .update(datasetFormingRuns)
      .set({ status: "publishing", errorMessage: null })
      .where(
        and(
          eq(datasetFormingRuns.id, row.id),
          eq(datasetFormingRuns.status, "valid"),
        ),
      )
      .returning();
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      throw new ImbFormingError(
        "Another IMB candidate is already being published.",
        409,
      );
    }
    throw error;
  }
  if (!publishing) throw new ImbFormingError("Candidate publication already changed.", 409);

  try {
    const [rowsBody, csvBody, manifestBody, resourceBinding] = await Promise.all([
      readImbFormingArtifact(rowsPath),
      readImbFormingArtifact(csvPath),
      readImbFormingArtifact(manifestPath),
      loadImbFormingResourceBinding(row.resourceSetId),
    ]);
    assertLineageMatchesRun({
      row,
      lineage: parseLineageManifest(manifestBody),
      resourceBinding,
    });
    const parsed = parseApiConnectionRowsArtifact(rowsBody);
    if (checksumApiConnectionArtifact(JSON.stringify({ columns: parsed.columns, rows: parsed.rows })) !== row.outputChecksum) {
      throw new Error("The candidate output checksum no longer matches its binding.");
    }
    if (
      csvBody !==
      serializeApiConnectionRowsToCsv({
        columns: parsed.columns,
        rows: parsed.rows,
      })
    ) {
      throw new Error("The candidate CSV no longer matches its formed rows.");
    }
    const fileName = `formed-${connection.datasetName}`;
    const blobPath = await uploadPublishedDatasetCsv(fileName, csvBody);
    const existingTarget = connection.targetDatasetId;
    const dataset = existingTarget
      ? (
          await replaceDatasetContents({
            datasetId: existingTarget,
            actorOwnerId: input.identity.ownerId,
            actorEmail: input.identity.email,
            blobPath,
            sizeBytes: Buffer.byteLength(csvBody),
            columns: parsed.columns,
            classification: connection.datasetClassification,
          })
        )?.dataset ?? null
      : await createDataset({
          ownerId: input.identity.ownerId,
          actorEmail: input.identity.email,
          fileName,
          blobPath,
          sizeBytes: Buffer.byteLength(csvBody),
          columns: parsed.columns,
          classification: connection.datasetClassification,
          isWorkspaceVisible: true,
        });
    if (!dataset) throw new Error("The IMB publication target was not found.");

    const batches = chunkRows(parsed.rows);
    if (batches.length === 0) {
      await insertDatasetRowBatch({
        datasetId: dataset.id,
        rows: [],
        startIndex: 0,
        isFinalBatch: true,
        totalRows: 0,
      });
    } else {
      let startIndex = 0;
      for (const [index, rows] of batches.entries()) {
        await insertDatasetRowBatch({
          datasetId: dataset.id,
          rows,
          startIndex,
          isFinalBatch: index === batches.length - 1,
          totalRows: parsed.rows.length,
        });
        startIndex += rows.length;
      }
    }

    if (!existingTarget) {
      await getDb()
        .update(apiConnections)
        .set({
          importMode: "replace",
          targetDatasetId: dataset.id,
          updatedByOwnerId: input.identity.ownerId,
          updatedAt: new Date(),
        })
        .where(eq(apiConnections.id, input.connectionId));
    }
    const [published] = await getDb()
      .update(datasetFormingRuns)
      .set({
        status: "published",
        datasetId: dataset.id,
        publicationReason: input.decision.reason.trim(),
        warningsAcknowledged: Boolean(input.decision.warningsAcknowledged),
        publishedByOwnerId: input.identity.ownerId,
        publishedAt: new Date(),
        errorMessage: null,
      })
      .where(
        and(
          eq(datasetFormingRuns.id, row.id),
          eq(datasetFormingRuns.status, "publishing"),
        ),
      )
      .returning();
    if (!published) throw new Error("Candidate publication state changed unexpectedly.");
    return hydrateFormingRun(published);
  } catch (error) {
    const message = error instanceof Error ? error.message : "IMB publication failed.";
    await getDb()
      .update(datasetFormingRuns)
      .set({ status: "valid", errorMessage: message })
      .where(
        and(
          eq(datasetFormingRuns.id, row.id),
          eq(datasetFormingRuns.status, "publishing"),
        ),
      );
    throw new ImbFormingError(message, 500);
  }
}

export async function getImbFormingArtifactDownload(input: {
  connectionId: string;
  sourceRunId: string;
  formingRunId: string;
  kind: ImbFormingArtifactKind;
}) {
  const row = await getFormingRunRecord(input);
  const path = row?.artifactManifest[input.kind];
  if (!row || !path) return null;
  return {
    body: await readImbFormingArtifact(path),
    contentType:
      input.kind === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
    fileName: `imb-forming-${row.id}-${input.kind}.${input.kind === "csv" ? "csv" : "json"}`,
  };
}
