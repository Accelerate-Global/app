import { Buffer } from "node:buffer";

import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  apiConnectionRunOutputs,
  apiConnectionRuns,
  apiConnections,
  datasetFormingFindings,
  datasetFormingResourceBindings,
  datasetFormingRuns,
  referenceResources,
  referenceResourceSetMembers,
  referenceResourceVersions,
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
  createDatasetFormingInputFingerprint,
  createDatasetFormingLineageManifest,
  createDatasetFormingPublicationManifest,
  createDatasetFormingPublicationRowBatches,
  datasetFormingEngineRegistry,
  IMB_FORMING_ENGINE,
  loadDatasetFormingRuntimeResources,
  projectLegacyImbLineage,
  resolveApiConnectionSourceProfileSnapshot,
  resolveDatasetFormingTargetDataset,
} from "@/lib/dataset-forming";
import {
  assertEligibleDatasetFormingSource,
  isStaleDatasetFormingBuild,
} from "@/lib/dataset-forming/policy";
import {
  deleteDatasetFormingArtifacts,
  readDatasetFormingArtifact,
  uploadDatasetFormingArtifact,
} from "@/lib/dataset-forming/storage";
import type {
  DatasetFormingEngine,
  DatasetFormingResourceBinding,
  DatasetFormingResult,
} from "@/lib/dataset-forming/types";
import { publishPreparedDataset } from "@/lib/datasets";
import {
  createDatasetStoragePath,
  getApiConnectionRunArtifactReadBuckets,
  getDatasetStorageBucket,
} from "@/lib/dataset-storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checksumSourceFormingValue } from "@/lib/source-forming";

import {
  assertDatasetFormingPublicationTargetCurrent,
  assertPublishableImbCandidate,
  FORMING_PUBLICATION_STALE_AFTER_MS,
  isStaleImbPublication,
} from "./policy";
import {
  loadImbFormingResourceBinding,
} from "./resources";
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
const FORMING_PUBLICATION_LOCK_NAMESPACE = 391_742;
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
type FormingResourceBindingRecord =
  typeof datasetFormingResourceBindings.$inferSelect;

async function loadResourceSetCatalogSnapshot(resourceSetId: string) {
  return getDb()
    .select({
      resourceKey: referenceResources.resourceKey,
      versionId: referenceResourceSetMembers.versionId,
      checksum: referenceResourceVersions.contentChecksum,
      versionNumber: referenceResourceVersions.versionNumber,
      schemaVersion: referenceResourceVersions.schemaVersion,
    })
    .from(referenceResourceSetMembers)
    .innerJoin(
      referenceResources,
      eq(referenceResourceSetMembers.resourceId, referenceResources.id),
    )
    .innerJoin(
      referenceResourceVersions,
      eq(referenceResourceSetMembers.versionId, referenceResourceVersions.id),
    )
    .where(eq(referenceResourceSetMembers.setId, resourceSetId));
}

function toResourceBinding(
  row: FormingResourceBindingRecord,
): DatasetFormingResourceBinding {
  return {
    position: row.position,
    key: row.bindingKey,
    bindingType: row.bindingType,
    required: row.required,
    kind: row.kind,
    schemaVersion: row.schemaVersion,
    version: row.version,
    checksum: row.checksum,
    resourceSetId: row.resourceSetId,
    resourceSetChecksum: row.resourceSetChecksum,
    resourceId: row.resourceId,
    resourceVersionId: row.resourceVersionId,
  };
}

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
  resourceBindings: DatasetFormingResourceBinding[];
}) {
  const { row, lineage, resourceBinding, resourceBindings } = input;
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

  if (lineage.datasetForming) {
    const generic = lineage.datasetForming;
    const genericMatches =
      generic.sourceProfileKey === row.sourceProfileKey &&
      generic.engineKey === row.engineKey &&
      generic.engineVersion === row.transformationVersion &&
      generic.engineChecksum === row.transformationChecksum &&
      generic.artifactSchemaVersion === row.artifactSchemaVersion &&
      generic.inputFingerprint === row.inputFingerprint &&
      generic.publicationTargetKey === row.publicationTargetKey &&
      JSON.stringify(generic.resourceBindings) ===
        JSON.stringify(resourceBindings);
    if (!genericMatches) {
      throw new Error("The generic candidate lineage no longer matches its bindings.");
    }
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
  const [findingRows, resourceBinding, bindingRows, downstreamIdentityRows] =
    await Promise.all([
    getDb()
      .select()
      .from(datasetFormingFindings)
      .where(eq(datasetFormingFindings.formingRunId, row.id))
      .orderBy(asc(datasetFormingFindings.id))
      .limit(FINDING_PREVIEW_LIMIT + 1),
    loadImbFormingResourceBinding(row.resourceSetId),
    getDb()
      .select()
      .from(datasetFormingResourceBindings)
      .where(eq(datasetFormingResourceBindings.formingRunId, row.id))
      .orderBy(asc(datasetFormingResourceBindings.position)),
    row.publicationId
      ? (getDb().execute(sql<{
          id: string;
          status: NonNullable<
            ImbFormingRun["downstreamIdentityRun"]
          >["status"];
          publication_id: string | null;
          registry_revision_id: string | null;
        }>`
          select id, status, publication_id, registry_revision_id
          from private.ax_identity_runs
          where source_publication_id = ${row.publicationId}::uuid
          order by created_at desc, id desc
          limit 1
        `) as unknown as Promise<Array<{
          id: string;
          status: NonNullable<
            ImbFormingRun["downstreamIdentityRun"]
          >["status"];
          publication_id: string | null;
          registry_revision_id: string | null;
        }>>)
      : Promise.resolve([]),
    ]);
  const findingsTruncated = findingRows.length > FINDING_PREVIEW_LIMIT;
  const downstreamIdentityRow = downstreamIdentityRows[0] ?? null;

  return {
    id: row.id,
    connectionId: row.connectionId,
    sourceRunId: row.sourceRunId,
    resourceSetId: row.resourceSetId,
    resourceSetChecksum: resourceBinding.resourceSetChecksum,
    countryVersionId: resourceBinding.countryVersionId,
    ropVersionId: resourceBinding.ropVersionId,
    sourceProfileKey: row.sourceProfileKey,
    engineKey: row.engineKey,
    engineLabel: getDatasetFormingEngineLabel(row.engineKey),
    artifactSchemaVersion: row.artifactSchemaVersion,
    inputFingerprint: row.inputFingerprint,
    attemptNumber: row.attemptNumber,
    publicationTargetKey: row.publicationTargetKey,
    expectedCurrentPublicationId: row.expectedCurrentPublicationId,
    resourceBindings: bindingRows.map(toResourceBinding),
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
    publicationId: row.publicationId,
    downstreamIdentityRun: downstreamIdentityRow
      ? {
          runId: downstreamIdentityRow.id,
          status: downstreamIdentityRow.status,
          publicationId: downstreamIdentityRow.publication_id,
          registryRevisionId: downstreamIdentityRow.registry_revision_id,
        }
      : null,
    rejectionReason: row.rejectionReason,
    rejectedByOwnerId: row.rejectedByOwnerId,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    publicationReason: row.publicationReason,
    warningsAcknowledged: row.warningsAcknowledged,
    publishedByOwnerId: row.publishedByOwnerId,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    publishingStartedAt: row.publishingStartedAt?.toISOString() ?? null,
    errorMessage: row.errorMessage,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    findings: findingRows.slice(0, FINDING_PREVIEW_LIMIT).map(toFinding),
    findingsTruncated,
  };
}

export function getDatasetFormingEngineLabel(engineKey: string) {
  return (
    datasetFormingEngineRegistry.getByEngineKey(engineKey)?.displayName ??
    "Unavailable forming engine"
  );
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

async function getDeterministicFormingRunByFingerprint(input: {
  sourceRunId: string;
  resourceSetId: string;
  inputFingerprint: string;
}) {
  const [row] = await getDb()
    .select()
    .from(datasetFormingRuns)
    .where(
      and(
        eq(datasetFormingRuns.sourceRunId, input.sourceRunId),
        eq(datasetFormingRuns.resourceSetId, input.resourceSetId),
        eq(datasetFormingRuns.inputFingerprint, input.inputFingerprint),
      ),
    )
    .orderBy(
      desc(datasetFormingRuns.attemptNumber),
      desc(datasetFormingRuns.createdAt),
      desc(datasetFormingRuns.id),
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
  resourceSetId?: string;
  expectedSourceProfile?: Readonly<{
    connectionId: string;
    profileKey: string;
    engineKey: string;
    stableKeyColumn: string | null;
    configurable: boolean;
    checksum: string;
  }>;
  expectedResourceSnapshot?: Readonly<{
    resourceSetChecksum: string;
    referenceVersionBindings: Readonly<
      Record<
        string,
        Readonly<{
          resourceKey: string;
          versionId: string;
          checksum: string;
          versionNumber: number;
          schemaVersion: number;
        }>
      >
    >;
  }>;
  expectedCurrentPublicationId?: string | null;
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

  if (!source) {
    throw new ImbFormingError(
      "A successful ingestion run is required before forming a dataset.",
      409,
    );
  }
  let pinnedSourceProfile;
  try {
    pinnedSourceProfile = resolveApiConnectionSourceProfileSnapshot({
      connectionId: input.connectionId,
      snapshot: source.run.sourceProfileSnapshot,
      checksum: source.run.sourceProfileChecksum,
    });
  } catch (error) {
    if (error instanceof Error && "status" in error) {
      throw new ImbFormingError(
        error.message,
        typeof error.status === "number" ? error.status : 409,
      );
    }
    throw error;
  }
  const sourceProfile = pinnedSourceProfile.snapshot;
  if (input.expectedSourceProfile) {
    const pinnedBinding = {
      connectionId: input.connectionId,
      profileKey: sourceProfile.sourceProfileKey,
      engineKey: sourceProfile.engineKey,
      stableKeyColumn: sourceProfile.stableKeyColumn,
      configurable: sourceProfile.configurable,
    };
    if (
      input.expectedSourceProfile.connectionId !== pinnedBinding.connectionId ||
      input.expectedSourceProfile.profileKey !== pinnedBinding.profileKey ||
      input.expectedSourceProfile.engineKey !== pinnedBinding.engineKey ||
      input.expectedSourceProfile.stableKeyColumn !== pinnedBinding.stableKeyColumn ||
      input.expectedSourceProfile.configurable !== pinnedBinding.configurable ||
      input.expectedSourceProfile.checksum !==
        checksumSourceFormingValue(pinnedBinding)
    ) {
      throw new ImbFormingError(
        "The source-profile configuration does not match this ingestion snapshot.",
        409,
      );
    }
  }
  let engine;
  try {
    engine = assertEligibleDatasetFormingSource({
      sourceProfileKey: sourceProfile.sourceProfileKey,
      status: source.run.status,
      mode: source.run.mode,
      rowsChecksum: source.output.rowsChecksum,
      rawChecksum: source.output.rawChecksum,
      registry: datasetFormingEngineRegistry,
    });
  } catch (error) {
    if (error instanceof Error && "status" in error) {
      throw new ImbFormingError(
        error.message,
        typeof error.status === "number" ? error.status : 409,
      );
    }
    throw error;
  }

  const resources = await loadDatasetFormingRuntimeResources({
    engine,
    resourceSetId: input.resourceSetId,
    sourceProfileKey: sourceProfile.sourceProfileKey,
    stableKeyColumn: sourceProfile.stableKeyColumn,
  });
  if (input.expectedResourceSnapshot) {
    if (
      resources.resourceSetChecksum !==
      input.expectedResourceSnapshot.resourceSetChecksum
    ) {
      throw new ImbFormingError(
        "The selected reference resource set checksum does not match the exact backfill snapshot.",
        409,
      );
    }
    const catalogBindings = await loadResourceSetCatalogSnapshot(
      resources.resourceSetId,
    );
    const expectedEntries = Object.entries(
      input.expectedResourceSnapshot.referenceVersionBindings,
    );
    if (expectedEntries.length !== catalogBindings.length) {
      throw new ImbFormingError(
        "The exact backfill resource bindings are incomplete or contain unexpected resources.",
        409,
      );
    }
    for (const binding of catalogBindings) {
      const expected =
        input.expectedResourceSnapshot.referenceVersionBindings[
          binding.resourceKey
        ];
      if (
        !expected ||
        expected.resourceKey !== binding.resourceKey ||
        expected.versionId !== binding.versionId ||
        expected.checksum !== binding.checksum ||
        expected.versionNumber !== binding.versionNumber ||
        expected.schemaVersion !== binding.schemaVersion
      ) {
        throw new ImbFormingError(
          `The exact backfill resource binding for ${binding.resourceKey} does not match the selected reference set.`,
          409,
        );
      }
    }
    if (
      expectedEntries.some(
        ([key, expected]) =>
          key !== expected.resourceKey ||
          !catalogBindings.some((binding) => binding.resourceKey === key),
      )
    ) {
      throw new ImbFormingError(
        "The exact backfill resource bindings contain an unexpected resource.",
        409,
      );
    }
  }
  const transformationChecksum = engine.checksum;
  const fieldContract = resources.resourceBindings.find(
    (binding) => binding.kind === "field-contract",
  );
  if (!fieldContract) {
    throw new ImbFormingError(
      "The forming engine is missing its immutable field contract.",
      409,
    );
  }
  const hasExplicitPublicationPin = Object.prototype.hasOwnProperty.call(
    input,
    "expectedCurrentPublicationId",
  );
  let resolvedInputFingerprint: string | null = null;
  try {
    const row = await getDb().transaction(async (tx) => {
      await tx.execute(sql`
        select pg_advisory_xact_lock(
          hashtextextended(
            ${`dataset-forming-start:${input.sourceRunId}:${resources.resourceSetId}:${engine.engineKey}`},
            0
          )
        )
      `);
      const currentPublications = hasExplicitPublicationPin
        ? []
        : ((await tx.execute(sql<{ id: string }>`
            select id
            from private.pipeline_publications
            where producer_kind = 'dataset-forming'
              and publication_target_key = ${engine.publicationTargetKey}
            order by created_at desc, id desc
            limit 1
          `)) as unknown as Array<{ id: string }>);
      const expectedCurrentPublicationId = hasExplicitPublicationPin
        ? (input.expectedCurrentPublicationId ?? null)
        : (currentPublications[0]?.id ?? null);
      const inputFingerprint = createDatasetFormingInputFingerprint({
        sourceProfileKey: sourceProfile.sourceProfileKey,
        sourceRowsChecksum: source.output.rowsChecksum!,
        sourceRawChecksum: source.output.rawChecksum!,
        engineKey: engine.engineKey,
        engineVersion: engine.version,
        engineChecksum: engine.checksum,
        artifactSchemaVersion: engine.artifactSchemaVersion,
        resourceSetId: resources.resourceSetId,
        resourceSetChecksum: resources.resourceSetChecksum,
        resourceBindings: resources.resourceBindings,
        expectedCurrentPublicationId,
      });
      resolvedInputFingerprint = inputFingerprint;
      let [existing] = await tx
        .select()
        .from(datasetFormingRuns)
        .where(
          and(
            eq(datasetFormingRuns.sourceRunId, input.sourceRunId),
            eq(datasetFormingRuns.resourceSetId, resources.resourceSetId),
            eq(datasetFormingRuns.inputFingerprint, inputFingerprint),
          ),
        )
        .orderBy(
          desc(datasetFormingRuns.attemptNumber),
          desc(datasetFormingRuns.createdAt),
          desc(datasetFormingRuns.id),
        )
        .limit(1);
      if (
        existing?.status === "building" &&
        isStaleDatasetFormingBuild(existing.createdAt)
      ) {
        const [failed] = await tx
          .update(datasetFormingRuns)
          .set({
            status: "failed",
            errorMessage:
              "The background build did not complete and was superseded.",
            completedAt: new Date(),
          })
          .where(
            and(
              eq(datasetFormingRuns.id, existing.id),
              eq(datasetFormingRuns.status, "building"),
            ),
          )
          .returning();
        if (failed) {
          existing = failed;
        } else {
          [existing] = await tx
            .select()
            .from(datasetFormingRuns)
            .where(eq(datasetFormingRuns.id, existing.id))
            .limit(1);
        }
      }
      if (existing && existing.status !== "failed") {
        return existing;
      }
      const attemptNumber = (existing?.attemptNumber ?? 0) + 1;
      const [inserted] = await tx
        .insert(datasetFormingRuns)
        .values({
          connectionId: input.connectionId,
          sourceRunId: input.sourceRunId,
          resourceSetId: resources.resourceSetId,
          sourceProfileKey: sourceProfile.sourceProfileKey,
          engineKey: engine.engineKey,
          artifactSchemaVersion: engine.artifactSchemaVersion,
          inputFingerprint,
          attemptNumber,
          publicationTargetKey: engine.publicationTargetKey,
          expectedCurrentPublicationId,
          actorOwnerId: input.identity.ownerId,
          actorEmail: input.identity.email,
          status: "building",
          sourceRowsChecksum: source.output.rowsChecksum!,
          sourceRawChecksum: source.output.rawChecksum!,
          fieldContractVersion: fieldContract.schemaVersion,
          fieldContractChecksum: fieldContract.checksum,
          transformationVersion: engine.version,
          transformationChecksum,
          inputRowCount: source.output.rowCount,
          validationSummary: EMPTY_VALIDATION,
          startedAt: null,
        })
        .returning();
      await tx.insert(datasetFormingResourceBindings).values(
        resources.resourceBindings.map((binding) => ({
          formingRunId: inserted.id,
          position: binding.position,
          bindingKey: binding.key,
          bindingType: binding.bindingType,
          required: binding.required,
          kind: binding.kind,
          version: binding.version,
          checksum: binding.checksum,
          schemaVersion: binding.schemaVersion,
          resourceSetId: binding.resourceSetId,
          resourceSetChecksum: binding.resourceSetChecksum,
          resourceId: binding.resourceId,
          resourceVersionId: binding.resourceVersionId,
        })),
      );
      return inserted;
    });
    return hydrateFormingRun(row);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      if (!resolvedInputFingerprint) {
        throw error;
      }
      const concurrent = await getDeterministicFormingRunByFingerprint({
        sourceRunId: input.sourceRunId,
        resourceSetId: resources.resourceSetId,
        inputFingerprint: resolvedInputFingerprint,
      });
      if (concurrent) {
        return hydrateFormingRun(concurrent);
      }
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

function checksumDatasetFormingRowsArtifact(input: {
  engineKey: string;
  columns: DatasetFormingResult["columns"];
  rows: DatasetFormingResult["rows"];
}) {
  const output = { columns: input.columns, rows: input.rows };
  return input.engineKey === IMB_FORMING_ENGINE.engineKey
    ? checksumApiConnectionArtifact(JSON.stringify(output))
    : checksumSourceFormingValue(output);
}

async function readCandidateArtifactForVerification(
  kind: ImbFormingArtifactKind,
  path: string,
) {
  try {
    return await readDatasetFormingArtifact(path);
  } catch {
    throw new Error(
      `Could not verify the uploaded candidate ${kind} artifact.`,
    );
  }
}

export async function verifyDatasetFormingCandidateArtifacts(input: {
  engineKey: string;
  result: DatasetFormingResult;
  lineage: ImbFormingLineageManifest;
  manifest: ImbFormingArtifactManifest;
}) {
  const rowsPath = input.manifest.rows;
  const csvPath = input.manifest.csv;
  const findingsPath = input.manifest.findings;
  const lineagePath = input.manifest.manifest;
  if (!rowsPath || !csvPath || !findingsPath || !lineagePath) {
    throw new Error(
      "The uploaded candidate artifact package is incomplete.",
    );
  }

  const [rowsBody, csvBody, findingsBody, lineageBody] = await Promise.all([
    readCandidateArtifactForVerification("rows", rowsPath),
    readCandidateArtifactForVerification("csv", csvPath),
    readCandidateArtifactForVerification("findings", findingsPath),
    readCandidateArtifactForVerification("manifest", lineagePath),
  ]);

  let parsedRows;
  try {
    parsedRows = parseApiConnectionRowsArtifact(rowsBody);
  } catch {
    throw new Error("The uploaded candidate rows artifact is invalid.");
  }
  const computedOutputChecksum = checksumDatasetFormingRowsArtifact({
    engineKey: input.engineKey,
    columns: parsedRows.columns,
    rows: parsedRows.rows,
  });
  if (computedOutputChecksum !== input.result.outputChecksum) {
    throw new Error(
      "The uploaded candidate output checksum does not match the engine result.",
    );
  }
  const expectedRowsBody = serializeApiConnectionRowsArtifact({
    columns: input.result.columns,
    rows: input.result.rows,
  });
  if (rowsBody !== expectedRowsBody) {
    throw new Error(
      "The uploaded candidate rows artifact does not match the engine result.",
    );
  }
  if (
    csvBody !==
    serializeApiConnectionRowsToCsv({
      columns: parsedRows.columns,
      rows: parsedRows.rows,
    })
  ) {
    throw new Error(
      "The uploaded candidate CSV artifact does not match its formed rows.",
    );
  }

  let parsedFindings: unknown;
  try {
    parsedFindings = JSON.parse(findingsBody);
  } catch {
    throw new Error("The uploaded candidate findings artifact is invalid.");
  }
  if (
    !Array.isArray(parsedFindings) ||
    JSON.stringify(parsedFindings) !== JSON.stringify(input.result.findings)
  ) {
    throw new Error(
      "The uploaded candidate findings artifact does not match the engine result.",
    );
  }
  const warningCount = input.result.findings.filter(
    (finding) => finding.severity === "warning",
  ).length;
  const errorCount = input.result.findings.filter(
    (finding) => finding.severity === "error",
  ).length;
  if (
    warningCount !== input.result.validation.warningCount ||
    errorCount !== input.result.validation.errorCount
  ) {
    throw new Error(
      "The candidate findings do not match the validation summary.",
    );
  }
  if (input.result.valid !== (errorCount === 0)) {
    throw new Error(
      "The candidate validity does not match its validation findings.",
    );
  }

  let parsedLineage: ImbFormingLineageManifest;
  try {
    parsedLineage = parseLineageManifest(lineageBody);
  } catch {
    throw new Error("The uploaded candidate lineage artifact is invalid.");
  }
  if (JSON.stringify(parsedLineage) !== JSON.stringify(input.lineage)) {
    throw new Error(
      "The uploaded candidate lineage artifact does not match the engine result.",
    );
  }

  return {
    outputSizeBytes: Buffer.byteLength(rowsBody),
  };
}

export async function claimDatasetFormingRunExecution(formingRunId: string) {
  const claimedAt = new Date();
  const [formingRun] = await getDb()
    .update(datasetFormingRuns)
    .set({
      executionClaimedAt: claimedAt,
      startedAt: claimedAt,
    })
    .where(
      and(
        eq(datasetFormingRuns.id, formingRunId),
        eq(datasetFormingRuns.status, "building"),
        isNull(datasetFormingRuns.executionClaimedAt),
      ),
    )
    .returning();
  return formingRun ?? null;
}

export async function executeImbFormingRun(formingRunId: string) {
  const formingRun = await claimDatasetFormingRunExecution(formingRunId);
  if (!formingRun) return null;

  const uploadedPaths: string[] = [];
  try {
    const engine = datasetFormingEngineRegistry.requireBySourceProfile(
      formingRun.sourceProfileKey,
    );
    const [sourceOutput] = await getDb()
      .select()
      .from(apiConnectionRunOutputs)
      .where(eq(apiConnectionRunOutputs.runId, formingRun.sourceRunId))
      .limit(1);
    if (!sourceOutput) throw new Error("The archived source output is missing.");

    const bindingRows = await getDb()
      .select()
      .from(datasetFormingResourceBindings)
      .where(eq(datasetFormingResourceBindings.formingRunId, formingRun.id))
      .orderBy(asc(datasetFormingResourceBindings.position));
    const persistedBindings = bindingRows.map(toResourceBinding);
    const stableKeyColumn = persistedBindings.find(
      (binding) => binding.kind === "source-profile-configuration",
    )?.version;
    const [rowsBody, rawBody, resources] = await Promise.all([
      readSourceArtifact(sourceOutput.rowsStoragePath),
      readSourceArtifact(sourceOutput.rawStoragePath),
      loadDatasetFormingRuntimeResources({
        engine,
        resourceSetId: formingRun.resourceSetId,
        sourceProfileKey: formingRun.sourceProfileKey,
        stableKeyColumn,
      }),
    ]);
    if (checksumApiConnectionArtifact(rowsBody) !== formingRun.sourceRowsChecksum) {
      throw new Error("The archived rows checksum no longer matches its binding.");
    }
    if (checksumApiConnectionArtifact(rawBody) !== formingRun.sourceRawChecksum) {
      throw new Error("The archived raw checksum no longer matches its binding.");
    }
    if (resources.resourceSetId !== formingRun.resourceSetId) {
      throw new Error("The pinned reference resource set could not be loaded.");
    }
    if (
      formingRun.engineKey !== engine.engineKey ||
      formingRun.transformationVersion !== engine.version ||
      formingRun.transformationChecksum !== engine.checksum ||
      formingRun.artifactSchemaVersion !==
        engine.artifactSchemaVersion ||
      formingRun.publicationTargetKey !==
        engine.publicationTargetKey
    ) {
      throw new Error(
        "The deployed forming engine no longer matches this candidate binding.",
      );
    }
    if (
      JSON.stringify(persistedBindings) !==
      JSON.stringify(resources.resourceBindings)
    ) {
      throw new Error(
        "The pinned forming resource bindings no longer match their catalog entries.",
      );
    }

    const source = parseApiConnectionRowsArtifact(rowsBody);
    const context = {
      connectionId: formingRun.connectionId,
      sourceProfileKey: formingRun.sourceProfileKey,
      sourceRunId: formingRun.sourceRunId,
      sourceArtifacts: {
        rowsChecksum: formingRun.sourceRowsChecksum,
        rawChecksum: formingRun.sourceRawChecksum,
      },
      columns: source.columns,
      rows: source.rows,
      resourceBindings: persistedBindings,
      resources: {
        countries: resources.countries,
        ropEntries: resources.ropEntries,
        ...(resources.jpPeopleId3Entries
          ? { jpPeopleId3Entries: resources.jpPeopleId3Entries }
          : {}),
        stableKeyColumn: resources.stableKeyColumn,
      },
    };
    const executableEngine = engine as DatasetFormingEngine<
      typeof context.resources,
      DatasetFormingResult
    >;
    const formed = executableEngine.form(context);
    const rowsArtifact = serializeApiConnectionRowsArtifact({
      columns: formed.columns,
      rows: formed.rows,
    });
    const findingsArtifact = JSON.stringify(formed.findings, null, 2);
    const csvArtifact = serializeApiConnectionRowsToCsv({
      columns: formed.columns,
      rows: formed.rows,
    });
    const genericLineage = createDatasetFormingLineageManifest({
      context,
      engine,
      result: formed,
      inputFingerprint: formingRun.inputFingerprint,
    });
    const lineageBase =
      engine.engineKey === IMB_FORMING_ENGINE.engineKey
        ? projectLegacyImbLineage(genericLineage as never)
        : {
            schemaVersion: 1 as const,
            connectionId: formingRun.connectionId,
            sourceRunId: formingRun.sourceRunId,
            sourceRowsChecksum: formingRun.sourceRowsChecksum,
            sourceRawChecksum: formingRun.sourceRawChecksum,
            resourceBinding: {
              resourceSetId: resources.resourceSetId,
              resourceSetChecksum: resources.resourceSetChecksum,
              countryVersionId:
                resources.resourceBindings.find(
                  (binding) => binding.key === "country-territory-codes",
                )?.resourceVersionId ?? "",
              ropVersionId:
                resources.resourceBindings.find(
                  (binding) => binding.key === "rop-codes",
                )?.resourceVersionId ?? "",
            },
            fieldContractVersion: formingRun.fieldContractVersion,
            fieldContractChecksum: formingRun.fieldContractChecksum,
            transformationVersion: formingRun.transformationVersion,
            transformationChecksum: formingRun.transformationChecksum,
            inputRowCount: source.rows.length,
            outputRowCount: formed.rows.length,
            outputChecksum: formed.outputChecksum,
            columns: formed.columns,
            validation: formed.validation as ImbFormingValidationSummary,
          };
    const lineage: ImbFormingLineageManifest = {
      ...lineageBase,
      datasetForming:
        genericLineage as ImbFormingLineageManifest["datasetForming"],
    };
    const bodies: Record<ImbFormingArtifactKind, string> = {
      rows: rowsArtifact,
      findings: findingsArtifact,
      manifest: JSON.stringify(lineage, null, 2),
      csv: csvArtifact,
    };
    const manifest: ImbFormingArtifactManifest = {};
    for (const kind of ["rows", "findings", "manifest", "csv"] as const) {
      const path = await uploadDatasetFormingArtifact({
        engineKey: engine.engineKey,
        sourceRunId: formingRun.sourceRunId,
        formingRunId: formingRun.id,
        kind,
        body: bodies[kind],
      });
      uploadedPaths.push(path);
      manifest[kind] = path;
    }

    const verifiedArtifacts = await verifyDatasetFormingCandidateArtifacts({
      engineKey: engine.engineKey,
      result: formed,
      lineage,
      manifest,
    });
    await persistFindings(formingRun.id, formed.findings);
    const [updated] = await getDb()
      .update(datasetFormingRuns)
      .set({
        status: formed.valid ? "valid" : "invalid",
        inputRowCount: source.rows.length,
        outputRowCount: formed.rows.length,
        warningCount: formed.validation.warningCount,
        errorCount: formed.validation.errorCount,
        validationSummary: formed.validation as ImbFormingValidationSummary,
        artifactManifest: manifest,
        outputChecksum: formed.outputChecksum,
        outputSizeBytes: verifiedArtifacts.outputSizeBytes,
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
    await deleteDatasetFormingArtifacts(uploadedPaths).catch(() => undefined);
    const message =
      error instanceof Error ? error.message : "Dataset forming failed.";
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

async function deletePublishedDatasetCsv(path: string) {
  const { error } = await createSupabaseAdminClient()
    .storage.from(getDatasetStorageBucket())
    .remove([path]);
  if (error) throw error;
}

export async function publishImbFormingRun(input: {
  connectionId: string;
  sourceRunId: string;
  formingRunId: string;
  identity: CurrentIdentity;
  decision: ImbFormingDecisionInput;
}) {
  const row = await getFormingRunRecord(input);
  if (!row) throw new ImbFormingError("Dataset forming candidate not found.", 404);
  const publicationClaimIsRecoverable =
    row.status === "publishing" &&
    row.publicationId === null &&
    isStaleImbPublication(row.publishingStartedAt);
  assertPublishableImbCandidate({
    status:
      row.status === "valid" || publicationClaimIsRecoverable
        ? "valid"
        : row.status,
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
  if (!connection) throw new ImbFormingError("Source connection not found.", 404);

  let publishing: FormingRunRecord | undefined;
  try {
    [publishing] = await getDb()
      .update(datasetFormingRuns)
      .set({
        status: "publishing",
        publishingStartedAt: new Date(),
        errorMessage: null,
      })
      .where(
        and(
          eq(datasetFormingRuns.id, row.id),
          or(
            eq(datasetFormingRuns.status, "valid"),
            and(
              eq(datasetFormingRuns.status, "publishing"),
              isNull(datasetFormingRuns.publicationId),
              or(
                isNull(datasetFormingRuns.publishingStartedAt),
                lte(
                  datasetFormingRuns.publishingStartedAt,
                  new Date(Date.now() - FORMING_PUBLICATION_STALE_AFTER_MS),
                ),
              ),
            ),
          ),
        ),
      )
      .returning();
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      throw new ImbFormingError(
        "Another candidate for this publication target is already being published.",
        409,
      );
    }
    throw error;
  }
  if (!publishing) throw new ImbFormingError("Candidate publication already changed.", 409);

  let uploadedDatasetPath: string | null = null;
  let publicationCommitted = false;
  try {
    const engine = datasetFormingEngineRegistry.requireBySourceProfile(
      row.sourceProfileKey,
    );
    if (
      engine.engineKey !== row.engineKey ||
      engine.version !== row.transformationVersion ||
      engine.checksum !== row.transformationChecksum ||
      engine.artifactSchemaVersion !== row.artifactSchemaVersion ||
      engine.publicationTargetKey !== row.publicationTargetKey
    ) {
      throw new Error(
        "The deployed forming engine no longer matches this candidate.",
      );
    }
    const currentPublicationRows = row.expectedCurrentPublicationId
      ? (await getDb().execute(sql<{
          publicationId: string;
          producerKind: string;
          sourceProfileKey: string | null;
          publicationTargetKey: string | null;
          producerDefinitionKey: string | null;
          datasetId: string;
          publicationRowCount: number;
          datasetRowCount: number;
          datasetStatus: string;
        }>`
          select publication.id as "publicationId",
            publication.producer_kind as "producerKind",
            publication.source_profile_key as "sourceProfileKey",
            publication.publication_target_key as "publicationTargetKey",
            publication.producer_definition_key as "producerDefinitionKey",
            publication.dataset_id as "datasetId",
            publication.row_count as "publicationRowCount",
            dataset.row_count as "datasetRowCount",
            dataset.status as "datasetStatus"
          from private.pipeline_publications as publication
          join public.datasets as dataset on dataset.id = publication.dataset_id
          where publication.id = ${row.expectedCurrentPublicationId}::uuid
          limit 1
        `)) as unknown as Array<{
          publicationId: string;
          producerKind: string;
          sourceProfileKey: string | null;
          publicationTargetKey: string | null;
          producerDefinitionKey: string | null;
          datasetId: string;
          publicationRowCount: number;
          datasetRowCount: number;
          datasetStatus: string;
        }>
      : [];
    const existingTarget = resolveDatasetFormingTargetDataset({
      expectedCurrentPublicationId: row.expectedCurrentPublicationId,
      expectedSourceProfileKey: row.sourceProfileKey,
      expectedPublicationTargetKey: row.publicationTargetKey,
      expectedProducerDefinitionKey: row.engineKey,
      connectionTargetDatasetId: connection.targetDatasetId,
      currentPublication: currentPublicationRows[0] ?? null,
    });
    const [
      rowsBody,
      csvBody,
      findingsBody,
      manifestBody,
      resourceBinding,
      bindingRows,
    ] = await Promise.all([
      readDatasetFormingArtifact(rowsPath),
      readDatasetFormingArtifact(csvPath),
      readDatasetFormingArtifact(findingsPath),
      readDatasetFormingArtifact(manifestPath),
      loadImbFormingResourceBinding(row.resourceSetId),
      getDb()
        .select()
        .from(datasetFormingResourceBindings)
        .where(eq(datasetFormingResourceBindings.formingRunId, row.id))
        .orderBy(asc(datasetFormingResourceBindings.position)),
    ]);
    const persistedBindings = bindingRows.map(toResourceBinding);
    const stableKeyColumn = persistedBindings.find(
      (binding) => binding.kind === "source-profile-configuration",
    )?.version;
    const currentResources = await loadDatasetFormingRuntimeResources({
      engine,
      resourceSetId: row.resourceSetId,
      sourceProfileKey: row.sourceProfileKey,
      stableKeyColumn,
    });
    if (
      JSON.stringify(currentResources.resourceBindings) !==
      JSON.stringify(persistedBindings)
    ) {
      throw new Error(
        "The candidate resource bindings no longer match their pinned versions.",
      );
    }
    assertLineageMatchesRun({
      row,
      lineage: parseLineageManifest(manifestBody),
      resourceBinding,
      resourceBindings: persistedBindings,
    });
    const parsed = parseApiConnectionRowsArtifact(rowsBody);
    const computedOutputChecksum =
      row.engineKey === IMB_FORMING_ENGINE.engineKey
        ? checksumApiConnectionArtifact(
            JSON.stringify({ columns: parsed.columns, rows: parsed.rows }),
          )
        : checksumSourceFormingValue({
            columns: parsed.columns,
            rows: parsed.rows,
          });
    if (computedOutputChecksum !== row.outputChecksum) {
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
    const parsedFindings = JSON.parse(findingsBody) as unknown;
    if (!Array.isArray(parsedFindings)) {
      throw new Error("The candidate findings artifact is invalid.");
    }
    const warningCount = parsedFindings.filter(
      (finding) =>
        typeof finding === "object" &&
        finding !== null &&
        "severity" in finding &&
        finding.severity === "warning",
    ).length;
    const errorCount = parsedFindings.filter(
      (finding) =>
        typeof finding === "object" &&
        finding !== null &&
        "severity" in finding &&
        finding.severity === "error",
    ).length;
    if (warningCount !== row.warningCount || errorCount !== row.errorCount) {
      throw new Error("The candidate findings no longer match their summary.");
    }
    const fileName = `formed-${connection.datasetName}`;
    const blobPath = await uploadPublishedDatasetCsv(fileName, csvBody);
    uploadedDatasetPath = blobPath;
    let published: FormingRunRecord | undefined;
    let sourcePublicationId: string | null = null;
    const publication = await publishPreparedDataset({
      targetDatasetId: existingTarget,
      actorOwnerId: input.identity.ownerId,
      actorEmail: input.identity.email,
      fileName,
      blobPath,
      sizeBytes: Buffer.byteLength(csvBody),
      columns: parsed.columns,
      rows: parsed.rows,
      classification: connection.datasetClassification,
      isWorkspaceVisible: true,
      finalize: async ({ executor, datasetId }) => {
        await executor.execute(sql`
          select pg_advisory_xact_lock(
            hashtextextended(
              ${`dataset-forming-publication:${row.publicationTargetKey}`},
              ${FORMING_PUBLICATION_LOCK_NAMESPACE}
            )
          )
        `);
        const currentPublications = (await executor.execute(sql<{ id: string }>`
          select id
          from private.pipeline_publications
          where producer_kind = 'dataset-forming'
            and publication_target_key = ${row.publicationTargetKey}
          order by created_at desc, id desc
          limit 1
        `)) as unknown as Array<{ id: string }>;
        assertDatasetFormingPublicationTargetCurrent({
          expectedCurrentPublicationId: row.expectedCurrentPublicationId,
          currentPublicationId: currentPublications[0]?.id ?? null,
        });
        const publications = (await executor.execute(sql<{ id: string }>`
          insert into private.pipeline_publications (
            producer_kind, producer_run_id, dataset_id, source_profile_key,
            registry_revision_id, output_checksum, row_count, artifact_manifest,
            actor_owner_id, actor_email, reason, publication_target_key,
            producer_definition_key, release_set_id
          ) values (
            'dataset-forming', ${row.id}::uuid, ${datasetId}::uuid,
            ${row.sourceProfileKey}, null, ${row.outputChecksum}, ${parsed.rows.length},
            ${JSON.stringify(createDatasetFormingPublicationManifest({
              schemaVersion: row.artifactSchemaVersion,
              formingRunId: row.id,
              sourceRunId: row.sourceRunId,
              resourceSetId: row.resourceSetId,
              inputFingerprint: row.inputFingerprint,
              artifacts: row.artifactManifest,
            }))}::jsonb,
            ${input.identity.ownerId}, ${input.identity.email},
            ${input.decision.reason.trim()}, ${row.publicationTargetKey},
            ${row.engineKey}, null
          )
          returning id
        `)) as unknown as Array<{ id: string }>;
        sourcePublicationId = publications[0]?.id ?? null;
        if (!sourcePublicationId) {
          throw new Error("The formed source publication could not be created.");
        }
        for (const { offset, rows: batch } of
          createDatasetFormingPublicationRowBatches(parsed.rows)) {
          await executor.execute(sql`
            insert into private.pipeline_publication_rows (
              publication_id, row_index, data
            )
            select ${sourcePublicationId}::uuid,
              (${offset} + ordinal - 1)::integer,
              value
            from jsonb_array_elements(${JSON.stringify(batch)}::jsonb)
              with ordinality as entry(value, ordinal)
          `);
        }
        if (!connection.targetDatasetId) {
          await executor
            .update(apiConnections)
            .set({
              importMode: "replace",
              targetDatasetId: datasetId,
              updatedByOwnerId: input.identity.ownerId,
              updatedAt: new Date(),
            })
            .where(eq(apiConnections.id, input.connectionId));
        }
        [published] = await executor
          .update(datasetFormingRuns)
          .set({
            status: "published",
            datasetId,
            publicationId: sourcePublicationId,
            publicationReason: input.decision.reason.trim(),
            warningsAcknowledged: Boolean(
              input.decision.warningsAcknowledged,
            ),
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
        if (!published) {
          throw new Error("Candidate publication state changed unexpectedly.");
        }
      },
    });
    const dataset = publication?.dataset ?? null;
    if (!dataset) throw new Error("The dataset publication target was not found.");
    publicationCommitted = true;
    if (!published) {
      throw new Error("Candidate publication state changed unexpectedly.");
    }
    return hydrateFormingRun(published);
  } catch (error) {
    if (uploadedDatasetPath && !publicationCommitted) {
      await deletePublishedDatasetCsv(uploadedDatasetPath).catch(() => undefined);
    }
    const message =
      error instanceof Error ? error.message : "IMB publication failed.";
    if (!publicationCommitted) {
      await getDb()
        .update(datasetFormingRuns)
        .set({
          status: "valid",
          publishingStartedAt: null,
          errorMessage: message,
        })
        .where(
          and(
            eq(datasetFormingRuns.id, row.id),
            eq(datasetFormingRuns.status, "publishing"),
          ),
        );
    }
    if (error instanceof ImbFormingError) throw error;
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
    body: await readDatasetFormingArtifact(path),
    contentType:
      input.kind === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
    fileName: `dataset-forming-${row.engineKey}-${row.id}-${input.kind}.${input.kind === "csv" ? "csv" : "json"}`,
  };
}
