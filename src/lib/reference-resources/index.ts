import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  lt,
  max,
  ne,
  sql,
} from "drizzle-orm";

import { getDb } from "@/db";
import {
  countryReferenceEntries,
  datasetFormingResourceBindings,
  datasetFormingRuns,
  pipelineReferenceEntries,
  referenceResourceActivationEvents,
  referenceResources,
  referenceResourceSetMembers,
  referenceResourceSets,
  referenceResourceValidationFindings,
  referenceResourceVersions,
  ropReferenceGeographies,
  ropReferencePeople,
  ropReferenceTerms,
} from "@/db/schema";
import type { IsoCountryCodeEntry, IsoCountryCodeResource } from "@/lib/iso-country-codes";
import type { RopCodeEntry, RopCodeResource } from "@/lib/rop-codes";

import {
  diffReferenceResources,
  getCountryStableKey,
  prepareReferenceResource,
  serializeCountryCsvRows,
  serializeRopCsvRows,
} from "./adapters";
import {
  canonicalizeReferenceResource,
  checksumReferenceResource,
  decodeReferenceResourceCursor,
  encodeReferenceResourceCursor,
} from "./canonical";
import { affectedEnginesForResource } from "./catalog-metadata";
import {
  preparePipelineResource,
  serializePipelineResourceCsv,
  validatePipelineResource,
} from "./pipeline-adapters";
import {
  isPipelineResourceKey,
  type PipelineResourceKey,
  type PipelineResourceValidationContext,
} from "./pipeline-types";
import {
  deleteReferenceResourceArtifacts,
  referenceResourceArtifactExists,
  readReferenceResourceArtifact,
  uploadReferenceResourceArtifact,
  type ReferenceResourceArtifactManifest,
} from "./storage";
import {
  COUNTRY_RESOURCE_KEY,
  ROP_RESOURCE_KEY,
  type ReferenceResourceActivationAction,
  type ReferenceResourceCandidateResult,
  type ReferenceResourceCatalogItem,
  type ReferenceResourceHealth,
  type ReferenceResourceEntryByKey,
  type ReferenceResourceKey,
  type ReferenceResourcePayloadByKey,
  type ReferenceResourcePageByKey,
  type ReferenceResourceQueryResult,
  type ReferenceResourceValidationFinding,
  type ReferenceResourceVersionSummary,
} from "./types";

const PROJECTION_BATCH_SIZE = 500;
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

export class ReferenceResourceConflictError extends Error {}
export class ReferenceResourceNotFoundError extends Error {}
export class ReferenceResourceValidationError extends Error {}

type ArtifactStore = {
  upload: typeof uploadReferenceResourceArtifact;
  remove: typeof deleteReferenceResourceArtifacts;
  exists: typeof referenceResourceArtifactExists;
};

const defaultArtifactStore: ArtifactStore = {
  upload: uploadReferenceResourceArtifact,
  remove: deleteReferenceResourceArtifacts,
  exists: referenceResourceArtifactExists,
};

function toIsoString(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toVersionSummary(input: {
  version: typeof referenceResourceVersions.$inferSelect;
  resourceKey: ReferenceResourceKey;
  activeVersionId: string | null;
}): ReferenceResourceVersionSummary {
  return {
    id: input.version.id,
    resourceKey: input.resourceKey,
    versionNumber: input.version.versionNumber,
    lifecycleState: input.version.lifecycleState,
    schemaVersion: input.version.schemaVersion,
    contentChecksum: input.version.contentChecksum,
    sourceRetrievedAt: input.version.sourceRetrievedAt.toISOString(),
    entryCount: input.version.entryCount,
    validationSummary: input.version.validationSummary,
    diffSummary: input.version.diffSummary,
    createdByOwnerId: input.version.createdByOwnerId,
    createdAt: input.version.createdAt.toISOString(),
    finalizedAt: toIsoString(input.version.finalizedAt),
    rejectionReason: input.version.rejectionReason,
    isActive: input.activeVersionId === input.version.id,
  };
}

async function getResourceDefinition(resourceKey: ReferenceResourceKey) {
  const [resource] = await getDb()
    .select()
    .from(referenceResources)
    .where(eq(referenceResources.resourceKey, resourceKey))
    .limit(1);
  if (!resource) {
    throw new ReferenceResourceNotFoundError(`Reference resource ${resourceKey} is not registered.`);
  }
  return resource;
}

async function getVersionRecord(versionId: string) {
  const [version] = await getDb()
    .select()
    .from(referenceResourceVersions)
    .where(eq(referenceResourceVersions.id, versionId))
    .limit(1);
  return version ?? null;
}

async function insertBatches<T>(
  rows: T[],
  insert: (rows: T[]) => Promise<unknown>,
) {
  for (let index = 0; index < rows.length; index += PROJECTION_BATCH_SIZE) {
    await insert(rows.slice(index, index + PROJECTION_BATCH_SIZE));
  }
}

async function writeProjections(
  versionId: string,
  prepared: ReturnType<typeof prepareReferenceResource>,
) {
  await insertBatches(prepared.countryEntries, (rows) =>
    getDb().insert(countryReferenceEntries).values(
      rows.map((row) => ({ ...row, versionId })),
    ),
  );
  await insertBatches(prepared.ropTerms, (rows) =>
    getDb().insert(ropReferenceTerms).values(rows.map((row) => ({ ...row, versionId }))),
  );
  await insertBatches(prepared.ropPeople, (rows) =>
    getDb().insert(ropReferencePeople).values(rows.map((row) => ({ ...row, versionId }))),
  );
  await insertBatches(prepared.ropGeographies, (rows) =>
    getDb()
      .insert(ropReferenceGeographies)
      .values(rows.map((row) => ({ ...row, versionId }))),
  );
  await insertBatches(prepared.pipelineEntries, (rows) =>
    getDb()
      .insert(pipelineReferenceEntries)
      .values(rows.map((row) => ({ ...row, versionId }))),
  );
}

async function verifyCandidatePackage(input: {
  versionId: string;
  prepared: ReturnType<typeof prepareReferenceResource>;
  artifactPaths: string[];
  artifactStore: ArtifactStore;
}) {
  if (input.artifactPaths.length !== 5) {
    throw new Error("Reference resource artifact manifest is incomplete.");
  }
  for (const path of input.artifactPaths) {
    if (!(await input.artifactStore.exists(path))) {
      throw new Error(`Reference resource artifact is missing: ${path}.`);
    }
  }
  const [
    [{ countryCount }],
    [{ termCount }],
    [{ peopleCount }],
    [{ geographyCount }],
    [{ pipelineCount }],
  ] =
    await Promise.all([
      getDb().select({ countryCount: count() }).from(countryReferenceEntries).where(eq(countryReferenceEntries.versionId, input.versionId)),
      getDb().select({ termCount: count() }).from(ropReferenceTerms).where(eq(ropReferenceTerms.versionId, input.versionId)),
      getDb().select({ peopleCount: count() }).from(ropReferencePeople).where(eq(ropReferencePeople.versionId, input.versionId)),
      getDb().select({ geographyCount: count() }).from(ropReferenceGeographies).where(eq(ropReferenceGeographies.versionId, input.versionId)),
      getDb().select({ pipelineCount: count() }).from(pipelineReferenceEntries).where(eq(pipelineReferenceEntries.versionId, input.versionId)),
    ]);
  if (
    countryCount !== input.prepared.countryEntries.length ||
    termCount !== input.prepared.ropTerms.length ||
    peopleCount !== input.prepared.ropPeople.length ||
    geographyCount !== input.prepared.ropGeographies.length ||
    pipelineCount !== input.prepared.pipelineEntries.length
  ) {
    throw new Error("Reference resource typed projection counts do not match the normalized package.");
  }
}

async function createBuildingVersion(input: {
  resourceId: string;
  schemaVersion: number;
  sourceRetrievedAt: Date;
  sourceMetadata: Record<string, unknown>;
  actorOwnerId: string;
}) {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.resourceId}, 1))`);
    const [{ highestVersion }] = await tx
      .select({ highestVersion: max(referenceResourceVersions.versionNumber) })
      .from(referenceResourceVersions)
      .where(eq(referenceResourceVersions.resourceId, input.resourceId));
    const [version] = await tx
      .insert(referenceResourceVersions)
      .values({
        resourceId: input.resourceId,
        versionNumber: (highestVersion ?? 0) + 1,
        schemaVersion: input.schemaVersion,
        sourceRetrievedAt: input.sourceRetrievedAt,
        sourceMetadata: input.sourceMetadata,
        createdByOwnerId: input.actorOwnerId,
      })
      .returning();
    return version;
  });
}

async function findEquivalentVersion(input: {
  resourceId: string;
  schemaVersion: number;
  checksum: string;
}) {
  const [version] = await getDb()
    .select()
    .from(referenceResourceVersions)
    .where(
      and(
        eq(referenceResourceVersions.resourceId, input.resourceId),
        eq(referenceResourceVersions.schemaVersion, input.schemaVersion),
        eq(referenceResourceVersions.contentChecksum, input.checksum),
        eq(referenceResourceVersions.lifecycleState, "valid"),
      ),
    )
    .orderBy(desc(referenceResourceVersions.createdAt))
    .limit(1);
  return version ?? null;
}

async function getActivePayload<K extends ReferenceResourceKey>(
  resourceKey: K,
): Promise<ReferenceResourcePayloadByKey[K] | null> {
  const resource = await getResourceDefinition(resourceKey);
  if (!resource.activeVersionId) return null;
  const version = await getVersionRecord(resource.activeVersionId);
  return (version?.normalizedResource as ReferenceResourcePayloadByKey[K] | null) ?? null;
}

export async function createReferenceResourceCandidate<K extends ReferenceResourceKey>(
  input: {
    resourceKey: K;
    payload: ReferenceResourcePayloadByKey[K];
    actorOwnerId: string;
    schemaVersion?: number;
    findings?: ReferenceResourceValidationFinding[];
    rawManifest?: Record<string, unknown>;
    validationContext?: PipelineResourceValidationContext;
  },
  dependencies: { artifactStore?: ArtifactStore } = {},
): Promise<ReferenceResourceCandidateResult> {
  const artifactStore = dependencies.artifactStore ?? defaultArtifactStore;
  const resource = await getResourceDefinition(input.resourceKey);
  const prepared = prepareReferenceResource(
    input.resourceKey,
    input.payload,
    input.validationContext,
  );
  const schemaVersion = input.schemaVersion ?? 1;
  const checksum = isPipelineResourceKey(input.resourceKey)
    ? preparePipelineResource(
        input.resourceKey,
        input.payload,
        input.validationContext,
      ).contentChecksum
    : checksumReferenceResource(input.payload);
  const equivalent = await findEquivalentVersion({
    resourceId: resource.id,
    schemaVersion,
    checksum,
  });
  if (equivalent) {
    return {
      unchanged: true,
      version: toVersionSummary({
        version: equivalent,
        resourceKey: input.resourceKey,
        activeVersionId: resource.activeVersionId,
      }),
    };
  }

  const activePayload = resource.activeVersionId
    ? await getActivePayload(input.resourceKey)
    : null;
  const diff = diffReferenceResources({
    resourceKey: input.resourceKey,
    previous: activePayload as never,
    next: input.payload as never,
  });
  const findings = [...prepared.findings, ...(input.findings ?? [])];
  const hasErrors = findings.some((finding) => finding.severity === "error");
  const version = await createBuildingVersion({
    resourceId: resource.id,
    schemaVersion,
    sourceRetrievedAt: prepared.sourceRetrievedAt,
    sourceMetadata: {
      ...prepared.sourceMetadata,
      ...(input.rawManifest ? { importManifest: input.rawManifest } : {}),
    },
    actorOwnerId: input.actorOwnerId,
  });
  const uploadedPaths: string[] = [];

  try {
    const manifest: ReferenceResourceArtifactManifest = {};
    for (const artifact of [
      {
        kind: "raw-manifest" as const,
        body: JSON.stringify(input.rawManifest ?? prepared.sourceMetadata, null, 2),
      },
      { kind: "normalized" as const, body: canonicalizeReferenceResource(input.payload) },
      { kind: "csv" as const, body: prepared.csv },
      { kind: "validation" as const, body: JSON.stringify({ findings }, null, 2) },
      { kind: "diff" as const, body: JSON.stringify(diff, null, 2) },
    ]) {
      const path = await artifactStore.upload({
        resourceKey: input.resourceKey,
        versionId: version.id,
        kind: artifact.kind,
        body: artifact.body,
      });
      manifest[artifact.kind] = path;
      uploadedPaths.push(path);
    }

    await writeProjections(version.id, prepared);
    if (findings.length > 0) {
      await getDb().insert(referenceResourceValidationFindings).values(
        findings.map((finding) => ({
          versionId: version.id,
          severity: finding.severity,
          ruleCode: finding.ruleCode,
          stableEntryKey: finding.stableEntryKey,
          fieldName: finding.fieldName,
          message: finding.message,
          details: finding.details ?? {},
        })),
      );
    }

    await verifyCandidatePackage({
      versionId: version.id,
      prepared,
      artifactPaths: uploadedPaths,
      artifactStore,
    });

    const [finalized] = await getDb()
      .update(referenceResourceVersions)
      .set({
        lifecycleState: hasErrors ? "invalid" : "valid",
        contentChecksum: checksum,
        normalizedResource: input.payload as unknown as Record<string, unknown>,
        artifactManifest: manifest as Record<string, string>,
        validationSummary: {
          errorCount: findings.filter((finding) => finding.severity === "error").length,
          warningCount: findings.filter((finding) => finding.severity === "warning").length,
          findingCount: findings.length,
        },
        diffSummary: diff.summary,
        entryCount: prepared.entryCount,
        finalizedAt: new Date(),
      })
      .where(
        and(
          eq(referenceResourceVersions.id, version.id),
          eq(referenceResourceVersions.lifecycleState, "building"),
        ),
      )
      .returning();
    if (!finalized) {
      throw new ReferenceResourceConflictError("Reference resource build was finalized elsewhere.");
    }
    return {
      unchanged: false,
      version: toVersionSummary({
        version: finalized,
        resourceKey: input.resourceKey,
        activeVersionId: resource.activeVersionId,
      }),
    };
  } catch (error) {
    await artifactStore.remove(uploadedPaths).catch(() => undefined);
    await getDb()
      .update(referenceResourceVersions)
      .set({
        lifecycleState: "invalid",
        contentChecksum: checksum,
        normalizedResource: input.payload as unknown as Record<string, unknown>,
        validationSummary: { errorCount: 1, warningCount: 0, findingCount: 1 },
        diffSummary: diff.summary,
        entryCount: prepared.entryCount,
        finalizedAt: new Date(),
        buildError: error instanceof Error ? error.message : "Reference resource build failed.",
      })
      .where(
        and(
          eq(referenceResourceVersions.id, version.id),
          eq(referenceResourceVersions.lifecycleState, "building"),
        ),
      );
    throw error;
  }
}

export async function createPipelineReferenceResourceCandidate<
  K extends PipelineResourceKey,
>(
  input: {
    resourceKey: K;
    payload: unknown;
    actorOwnerId: string;
    rawManifest: Record<string, unknown>;
    validationContext?: PipelineResourceValidationContext;
  },
  dependencies: { artifactStore?: ArtifactStore } = {},
): Promise<ReferenceResourceCandidateResult> {
  const validation = validatePipelineResource(
    input.resourceKey,
    input.payload,
    input.validationContext,
  );
  if (validation.valid && validation.resource) {
    return createReferenceResourceCandidate(
      {
        resourceKey: input.resourceKey,
        payload: input.payload as ReferenceResourcePayloadByKey[K],
        actorOwnerId: input.actorOwnerId,
        schemaVersion: validation.resource.schemaVersion,
        rawManifest: input.rawManifest,
        validationContext: input.validationContext,
      },
      dependencies,
    );
  }

  const artifactStore = dependencies.artifactStore ?? defaultArtifactStore;
  const resource = await getResourceDefinition(input.resourceKey);
  const payload =
    input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
      ? (input.payload as Record<string, unknown>)
      : { value: input.payload };
  const sourceRetrievedAtValue = payload.sourceRetrievedAt;
  const parsedRetrievedAt =
    typeof sourceRetrievedAtValue === "string"
      ? new Date(sourceRetrievedAtValue)
      : new Date();
  const sourceRetrievedAt = Number.isNaN(parsedRetrievedAt.getTime())
    ? new Date()
    : parsedRetrievedAt;
  const checksum = checksumReferenceResource(payload);
  const version = await createBuildingVersion({
    resourceId: resource.id,
    schemaVersion: 1,
    sourceRetrievedAt,
    sourceMetadata: {
      sourceName:
        typeof payload.sourceName === "string"
          ? payload.sourceName
          : "Invalid pipeline resource import",
      importManifest: input.rawManifest,
    },
    actorOwnerId: input.actorOwnerId,
  });
  const uploadedPaths: string[] = [];
  try {
    const manifest: ReferenceResourceArtifactManifest = {};
    const summary = {
      added: 0,
      changed: 0,
      removed: 0,
      unchanged: 0,
      highRisk: validation.findings.filter((item) => item.severity === "error")
        .length,
    };
    for (const artifact of [
      {
        kind: "raw-manifest" as const,
        body: JSON.stringify(input.rawManifest, null, 2),
      },
      {
        kind: "normalized" as const,
        body: canonicalizeReferenceResource(payload),
      },
      { kind: "csv" as const, body: "" },
      {
        kind: "validation" as const,
        body: JSON.stringify({ findings: validation.findings }, null, 2),
      },
      { kind: "diff" as const, body: JSON.stringify({ summary }, null, 2) },
    ]) {
      const path = await artifactStore.upload({
        resourceKey: input.resourceKey,
        versionId: version.id,
        kind: artifact.kind,
        body: artifact.body,
      });
      manifest[artifact.kind] = path;
      uploadedPaths.push(path);
    }
    for (const path of uploadedPaths) {
      if (!(await artifactStore.exists(path))) {
        throw new Error(`Reference resource artifact is missing: ${path}.`);
      }
    }
    if (validation.findings.length > 0) {
      await getDb().insert(referenceResourceValidationFindings).values(
        validation.findings.map((item) => ({
          versionId: version.id,
          severity: item.severity,
          ruleCode: item.ruleCode,
          stableEntryKey: item.stableEntryKey,
          fieldName: item.fieldName,
          message: item.message,
          details: item.details,
        })),
      );
    }
    const rawEntries = Array.isArray(payload.entries) ? payload.entries.length : 0;
    const [finalized] = await getDb()
      .update(referenceResourceVersions)
      .set({
        lifecycleState: "invalid",
        contentChecksum: checksum,
        normalizedResource: payload,
        artifactManifest: manifest as Record<string, string>,
        validationSummary: {
          errorCount: validation.findings.filter(
            (item) => item.severity === "error",
          ).length,
          warningCount: validation.findings.filter(
            (item) => item.severity === "warning",
          ).length,
          findingCount: validation.findings.length,
        },
        diffSummary: summary,
        entryCount: rawEntries,
        finalizedAt: new Date(),
        buildError: "Pipeline resource validation failed.",
      })
      .where(
        and(
          eq(referenceResourceVersions.id, version.id),
          eq(referenceResourceVersions.lifecycleState, "building"),
        ),
      )
      .returning();
    if (!finalized) {
      throw new ReferenceResourceConflictError(
        "Reference resource build was finalized elsewhere.",
      );
    }
    return {
      unchanged: false,
      version: toVersionSummary({
        version: finalized,
        resourceKey: input.resourceKey,
        activeVersionId: resource.activeVersionId,
      }),
    };
  } catch (error) {
    await artifactStore.remove(uploadedPaths).catch(() => undefined);
    await getDb()
      .update(referenceResourceVersions)
      .set({
        lifecycleState: "invalid",
        contentChecksum: checksum,
        normalizedResource: payload,
        validationSummary: {
          errorCount: Math.max(
            1,
            validation.findings.filter((item) => item.severity === "error")
              .length,
          ),
          warningCount: validation.findings.filter(
            (item) => item.severity === "warning",
          ).length,
          findingCount: Math.max(1, validation.findings.length),
        },
        diffSummary: {},
        entryCount: Array.isArray(payload.entries) ? payload.entries.length : 0,
        finalizedAt: new Date(),
        buildError:
          error instanceof Error
            ? error.message
            : "Reference resource build failed.",
      })
      .where(
        and(
          eq(referenceResourceVersions.id, version.id),
          eq(referenceResourceVersions.lifecycleState, "building"),
        ),
      );
    throw error;
  }
}

export async function activateReferenceResource(input: {
  resourceKey: ReferenceResourceKey;
  versionId: string;
  expectedActiveVersionId: string | null;
  actorOwnerId: string;
  reason: string;
  action?: ReferenceResourceActivationAction;
}) {
  try {
    const result = await getDb().execute(sql<{ set_id: string }>`
      select private.activate_reference_resource(
        ${input.resourceKey},
        ${input.versionId}::uuid,
        ${input.expectedActiveVersionId}::uuid,
        ${input.actorOwnerId},
        ${input.reason},
        ${input.action ?? "activate"}
      ) as set_id
    `);
    return result[0]?.set_id ?? null;
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "40001") {
      throw new ReferenceResourceConflictError("The active resource version changed. Refresh and review again.");
    }
    if (code === "23514" || code === "22023") {
      throw new ReferenceResourceValidationError(
        error instanceof Error ? error.message : "Reference resource activation is invalid.",
      );
    }
    throw error;
  }
}

export async function rejectReferenceResourceVersion(input: {
  resourceKey: ReferenceResourceKey;
  versionId: string;
  actorOwnerId: string;
  reason: string;
}) {
  const resource = await getResourceDefinition(input.resourceKey);
  if (!input.reason.trim()) {
    throw new ReferenceResourceValidationError("A rejection reason is required.");
  }
  const [version] = await getDb()
    .update(referenceResourceVersions)
    .set({
      lifecycleState: "rejected",
      rejectedByOwnerId: input.actorOwnerId,
      rejectedAt: new Date(),
      rejectionReason: input.reason.trim(),
    })
    .where(
      and(
        eq(referenceResourceVersions.id, input.versionId),
        eq(referenceResourceVersions.resourceId, resource.id),
        eq(referenceResourceVersions.lifecycleState, "valid"),
        ne(referenceResourceVersions.id, resource.activeVersionId ?? "00000000-0000-0000-0000-000000000000"),
      ),
    )
    .returning();
  if (!version) {
    throw new ReferenceResourceValidationError("Only an inactive valid candidate can be rejected.");
  }
  return toVersionSummary({
    version,
    resourceKey: input.resourceKey,
    activeVersionId: resource.activeVersionId,
  });
}

export async function listReferenceResourceCatalog(input?: { includeAdminState?: boolean }) {
  const resources = await getDb()
    .select()
    .from(referenceResources)
    .orderBy(asc(referenceResources.sortOrder), asc(referenceResources.label));
  const activeIds = resources.flatMap((resource) =>
    resource.activeVersionId ? [resource.activeVersionId] : [],
  );
  const activeVersions = activeIds.length
    ? await getDb()
        .select()
        .from(referenceResourceVersions)
        .where(inArray(referenceResourceVersions.id, activeIds))
    : [];
  const activeById = new Map(activeVersions.map((version) => [version.id, version]));
  const recentBindings = await getDb()
    .select({
      resourceId: datasetFormingResourceBindings.resourceId,
      resourceVersionId: datasetFormingResourceBindings.resourceVersionId,
      formingRunId: datasetFormingResourceBindings.formingRunId,
    })
    .from(datasetFormingResourceBindings)
    .innerJoin(
      datasetFormingRuns,
      eq(datasetFormingResourceBindings.formingRunId, datasetFormingRuns.id),
    )
    .where(
      and(
        eq(datasetFormingResourceBindings.bindingType, "catalog"),
        gt(
          datasetFormingRuns.createdAt,
          new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        ),
      ),
    );
  const olderRunsByResource = new Map<string, Set<string>>();
  for (const binding of recentBindings) {
    if (!binding.resourceId || !binding.resourceVersionId) continue;
    const activeVersionId = resources.find(
      (resource) => resource.id === binding.resourceId,
    )?.activeVersionId;
    if (!activeVersionId || binding.resourceVersionId === activeVersionId) continue;
    const runs = olderRunsByResource.get(binding.resourceId) ?? new Set<string>();
    runs.add(binding.formingRunId);
    olderRunsByResource.set(binding.resourceId, runs);
  }
  const attentionByResource = new Map<string, ReferenceResourceCatalogItem["attentionState"]>();
  if (input?.includeAdminState) {
    const candidates = await getDb()
      .select()
      .from(referenceResourceVersions)
      .where(inArray(referenceResourceVersions.lifecycleState, ["building", "valid", "invalid"]))
      .orderBy(desc(referenceResourceVersions.createdAt));
    for (const candidate of candidates) {
      if (activeIds.includes(candidate.id) || attentionByResource.has(candidate.resourceId)) continue;
      attentionByResource.set(
        candidate.resourceId,
        candidate.lifecycleState === "building"
          ? "interrupted-build"
          : candidate.lifecycleState === "invalid"
            ? "invalid-build"
            : "valid-candidate",
      );
    }
  }
  return resources.map((resource): ReferenceResourceCatalogItem => {
    const active = resource.activeVersionId
      ? activeById.get(resource.activeVersionId) ?? null
      : null;
    return {
      id: resource.id,
      resourceKey: resource.resourceKey as ReferenceResourceKey,
      resourceKind: resource.resourceKind,
      label: resource.label,
      description: resource.description,
      routePath: resource.routePath,
      sortOrder: resource.sortOrder,
      activeVersion: active
        ? toVersionSummary({
            version: active,
            resourceKey: resource.resourceKey as ReferenceResourceKey,
            activeVersionId: resource.activeVersionId,
          })
        : null,
      impact: {
        affectedEngines: affectedEnginesForResource(
          resource.resourceKey as ReferenceResourceKey,
        ),
        olderOutputCount: olderRunsByResource.get(resource.id)?.size ?? 0,
      },
      ...(input?.includeAdminState
        ? { attentionState: attentionByResource.get(resource.id) ?? null }
        : {}),
    };
  });
}

export async function listReferenceResourceVersions(resourceKey: ReferenceResourceKey) {
  const resource = await getResourceDefinition(resourceKey);
  const versions = await getDb()
    .select()
    .from(referenceResourceVersions)
    .where(eq(referenceResourceVersions.resourceId, resource.id))
    .orderBy(desc(referenceResourceVersions.versionNumber));
  return versions.map((version) =>
    toVersionSummary({ version, resourceKey, activeVersionId: resource.activeVersionId }),
  );
}

export async function listReferenceResourceFindings(input: {
  resourceKey: ReferenceResourceKey;
  versionId: string;
}) {
  const resource = await getResourceDefinition(input.resourceKey);
  const version = await getVersionRecord(input.versionId);
  if (!version || version.resourceId !== resource.id) {
    throw new ReferenceResourceNotFoundError("Reference resource version was not found.");
  }
  return getDb()
    .select()
    .from(referenceResourceValidationFindings)
    .where(eq(referenceResourceValidationFindings.versionId, input.versionId))
    .orderBy(
      asc(referenceResourceValidationFindings.severity),
      asc(referenceResourceValidationFindings.createdAt),
    );
}

export async function getReferenceResourceDiff(input: {
  resourceKey: ReferenceResourceKey;
  versionId: string;
}) {
  const resource = await getResourceDefinition(input.resourceKey);
  const version = await getVersionRecord(input.versionId);
  if (!version || version.resourceId !== resource.id) {
    throw new ReferenceResourceNotFoundError("Reference resource version was not found.");
  }
  const path = (version.artifactManifest as ReferenceResourceArtifactManifest)["diff"];
  if (!path) throw new ReferenceResourceNotFoundError("Reference resource diff was not found.");
  return JSON.parse(await readReferenceResourceArtifact(path)) as unknown;
}

export async function listReferenceResourceActivationHistory(
  resourceKey: ReferenceResourceKey,
) {
  const resource = await getResourceDefinition(resourceKey);
  return getDb()
    .select()
    .from(referenceResourceActivationEvents)
    .where(eq(referenceResourceActivationEvents.resourceId, resource.id))
    .orderBy(desc(referenceResourceActivationEvents.createdAt));
}

export async function getActiveReferenceResource<K extends ReferenceResourceKey>(
  resourceKey: K,
) {
  const resource = await getResourceDefinition(resourceKey);
  if (!resource.activeVersionId) {
    throw new ReferenceResourceNotFoundError(`${resource.label} has no active version.`);
  }
  const version = await getVersionRecord(resource.activeVersionId);
  if (!version || version.lifecycleState !== "valid" || !version.normalizedResource) {
    throw new ReferenceResourceNotFoundError(`${resource.label} active version is unhealthy.`);
  }
  return {
    payload: version.normalizedResource as ReferenceResourcePayloadByKey[K],
    version: toVersionSummary({
      version,
      resourceKey,
      activeVersionId: resource.activeVersionId,
    }),
  };
}

export async function getReferenceResourceVersion<K extends ReferenceResourceKey>(
  resourceKey: K,
  versionId: string,
) {
  const resource = await getResourceDefinition(resourceKey);
  const version = await getVersionRecord(versionId);
  if (
    !version ||
    version.resourceId !== resource.id ||
    version.lifecycleState !== "valid" ||
    !version.normalizedResource
  ) {
    throw new ReferenceResourceNotFoundError(
      `${resource.label} version ${versionId} is unavailable or unhealthy.`,
    );
  }
  return {
    payload: version.normalizedResource as ReferenceResourcePayloadByKey[K],
    version: toVersionSummary({
      version,
      resourceKey,
      activeVersionId: resource.activeVersionId,
    }),
  };
}

export async function getActiveReferenceResourceVersion(resourceKey: ReferenceResourceKey) {
  const resource = await getResourceDefinition(resourceKey);
  if (!resource.activeVersionId) {
    throw new ReferenceResourceNotFoundError(`${resource.label} has no active version.`);
  }
  const version = await getVersionRecord(resource.activeVersionId);
  if (!version || version.lifecycleState !== "valid") {
    throw new ReferenceResourceNotFoundError(`${resource.label} active version is unhealthy.`);
  }
  return toVersionSummary({ version, resourceKey, activeVersionId: resource.activeVersionId });
}

function normalizePageSize(limit: number | undefined) {
  if (!Number.isFinite(limit)) return DEFAULT_PAGE_SIZE;
  return Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(limit ?? DEFAULT_PAGE_SIZE)));
}

function mapCountryRow(row: typeof countryReferenceEntries.$inferSelect): IsoCountryCodeEntry {
  return {
    displayName: row.displayName,
    active: row.active,
    primaryAlpha3: row.primaryAlpha3,
    officialIsoAlpha2: row.officialIsoAlpha2,
    officialIsoAlpha3: row.officialIsoAlpha3,
    officialIsoNumeric: row.officialIsoNumeric,
    untermEnglishShortName: row.untermEnglishShortName,
    untermEnglishFormalName: row.untermEnglishFormalName,
    untermNameSource: row.untermNameSource,
    gencAlpha2: row.gencAlpha2,
    gencAlpha3: row.gencAlpha3,
    gencNumeric: row.gencNumeric,
    fips: row.fips,
    rog3: row.rog3,
    alternativeNames: row.alternativeNames,
    classification: row.classification,
    sourceUri: row.sourceUri,
  };
}

export async function queryReferenceResourceEntries<K extends ReferenceResourceKey>(input: {
  resourceKey: K;
  search?: string;
  cursor?: string | null;
  limit?: number;
  versionId?: string;
}): Promise<ReferenceResourceQueryResult<ReferenceResourceEntryByKey[K]>> {
  const resource = await getResourceDefinition(input.resourceKey);
  const versionId = input.versionId ?? resource.activeVersionId;
  if (!versionId) throw new ReferenceResourceNotFoundError("Reference resource has no active version.");
  const version = await getVersionRecord(versionId);
  if (!version || version.resourceId !== resource.id || !version.normalizedResource) {
    throw new ReferenceResourceNotFoundError("Reference resource version was not found.");
  }
  const limit = normalizePageSize(input.limit);
  const cursor = decodeReferenceResourceCursor(input.cursor);
  if (input.cursor && !cursor) {
    throw new ReferenceResourceValidationError("Reference resource cursor is invalid.");
  }
  const search = input.search?.trim().toLocaleLowerCase() ?? "";

  if (input.resourceKey === COUNTRY_RESOURCE_KEY) {
    const rows = await getDb()
      .select()
      .from(countryReferenceEntries)
      .where(
        and(
          eq(countryReferenceEntries.versionId, versionId),
          cursor ? gt(countryReferenceEntries.stableKey, cursor) : undefined,
          search ? ilike(countryReferenceEntries.searchText, `%${search}%`) : undefined,
        ),
      )
      .orderBy(asc(countryReferenceEntries.stableKey))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return {
      entries: page.map(mapCountryRow) as never,
      nextCursor: hasMore ? encodeReferenceResourceCursor(page.at(-1)!.stableKey) : null,
      version: toVersionSummary({
        version,
        resourceKey: input.resourceKey,
        activeVersionId: resource.activeVersionId,
      }),
    };
  }

  if (isPipelineResourceKey(input.resourceKey)) {
    const rows = await getDb()
      .select()
      .from(pipelineReferenceEntries)
      .where(
        and(
          eq(pipelineReferenceEntries.versionId, versionId),
          cursor ? gt(pipelineReferenceEntries.stableKey, cursor) : undefined,
          search
            ? ilike(pipelineReferenceEntries.searchText, `%${search}%`)
            : undefined,
        ),
      )
      .orderBy(asc(pipelineReferenceEntries.stableKey))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return {
      entries: page.map((row) => row.data) as ReferenceResourceEntryByKey[K][],
      nextCursor: hasMore
        ? encodeReferenceResourceCursor(page.at(-1)!.stableKey)
        : null,
      version: toVersionSummary({
        version,
        resourceKey: input.resourceKey,
        activeVersionId: resource.activeVersionId,
      }),
    };
  }

  const rows = await getDb()
    .select({ stableKey: ropReferencePeople.stableKey })
    .from(ropReferencePeople)
    .where(
      and(
        eq(ropReferencePeople.versionId, versionId),
        cursor ? gt(ropReferencePeople.stableKey, cursor) : undefined,
        search ? ilike(ropReferencePeople.searchText, `%${search}%`) : undefined,
      ),
    )
    .orderBy(asc(ropReferencePeople.stableKey))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const payload = version.normalizedResource as unknown as RopCodeResource;
  const entriesById = new Map(payload.entries.map((entry) => [entry.id, entry]));
  return {
    entries: page.map((row) => entriesById.get(row.stableKey)).filter(Boolean) as never,
    nextCursor: hasMore ? encodeReferenceResourceCursor(page.at(-1)!.stableKey) : null,
    version: toVersionSummary({
      version,
      resourceKey: input.resourceKey,
      activeVersionId: resource.activeVersionId,
    }),
  };
}

function pickRecordValues<T>(record: Record<string, T>, keys: Set<string>) {
  return Object.fromEntries(
    Array.from(keys, (key) => [key, record[key]]).filter((entry) => entry[1] !== undefined),
  ) as Record<string, T>;
}

function buildRopPageResource(
  payload: RopCodeResource,
  entries: RopCodeEntry[],
): RopCodeResource {
  const rop1Codes = new Set(entries.flatMap((entry) => (entry.rop1 ? [entry.rop1.code] : [])));
  const rop2Codes = new Set(entries.flatMap((entry) => (entry.rop2 ? [entry.rop2.code] : [])));
  const rop25Codes = new Set(entries.flatMap((entry) => (entry.rop25 ? [entry.rop25.code] : [])));
  const rop3Codes = new Set(entries.flatMap((entry) => (entry.rop3 ? [entry.rop3.code] : [])));
  return {
    ...payload,
    entries,
    rop1DetailsByCode: pickRecordValues(payload.rop1DetailsByCode, rop1Codes),
    rop2DetailsByCode: pickRecordValues(payload.rop2DetailsByCode, rop2Codes),
    rop25DetailsByCode: pickRecordValues(payload.rop25DetailsByCode, rop25Codes),
    rop3DetailsByCode: pickRecordValues(payload.rop3DetailsByCode, rop3Codes),
    geoIndexByRop3: pickRecordValues(payload.geoIndexByRop3, rop3Codes),
  };
}

export async function getReferenceResourcePage<K extends ReferenceResourceKey>(input: {
  resourceKey: K;
  search?: string;
  cursor?: string | null;
  limit?: number;
  versionId?: string;
}): Promise<ReferenceResourcePageByKey[K]> {
  const query = await queryReferenceResourceEntries(input);
  const versionRecord = await getVersionRecord(query.version.id);
  if (!versionRecord?.normalizedResource) {
    throw new ReferenceResourceNotFoundError("Reference resource version payload was not found.");
  }
  const payload = versionRecord.normalizedResource as ReferenceResourcePayloadByKey[K];
  if (input.resourceKey === COUNTRY_RESOURCE_KEY) {
    return {
      ...query,
      resource: {
        ...(payload as IsoCountryCodeResource),
        entries: query.entries as IsoCountryCodeEntry[],
      },
    } as unknown as ReferenceResourcePageByKey[K];
  }
  if (input.resourceKey === ROP_RESOURCE_KEY) {
    return {
      ...query,
      resource: buildRopPageResource(
        payload as RopCodeResource,
        query.entries as RopCodeEntry[],
      ),
    } as unknown as ReferenceResourcePageByKey[K];
  }
  return {
    ...query,
    resource: {
      ...(payload as ReferenceResourcePayloadByKey[PipelineResourceKey]),
      entries: query.entries,
    },
  } as unknown as ReferenceResourcePageByKey[K];
}

export async function getReferenceResourceCsv(input: {
  resourceKey: ReferenceResourceKey;
  search?: string;
}) {
  const active = await getActiveReferenceResource(input.resourceKey);
  const prepared = prepareReferenceResource(input.resourceKey, active.payload as never);
  if (!input.search?.trim()) return prepared.csv;
  const query = input.search.trim().toLocaleLowerCase();
  if (input.resourceKey === COUNTRY_RESOURCE_KEY) {
    const payload = active.payload as IsoCountryCodeResource;
    return prepareReferenceResource(COUNTRY_RESOURCE_KEY, {
      ...payload,
      entries: payload.entries.filter((entry) =>
        prepared.countryEntries.find(
          (projection) =>
            projection.stableKey === getCountryStableKey(entry) &&
            projection.searchText.includes(query),
        ),
      ),
    }).csv;
  }
  if (isPipelineResourceKey(input.resourceKey)) {
    const query = input.search.trim().toLocaleLowerCase();
    const matching = prepared.pipelineEntries
      .filter((entry) => entry.searchText.includes(query))
      .map((entry) => entry.data);
    return serializePipelineResourceCsv(input.resourceKey, matching as never);
  }
  const payload = active.payload as RopCodeResource;
  const matching = new Set(
    prepared.ropPeople.filter((entry) => entry.searchText.includes(query)).map((entry) => entry.stableKey),
  );
  return prepareReferenceResource(ROP_RESOURCE_KEY, {
    ...payload,
    entries: payload.entries.filter((entry) => matching.has(entry.id)),
    entryCount: matching.size,
  }).csv;
}

export function createReferenceResourceCsvStream(input: {
  resourceKey: ReferenceResourceKey;
  search?: string;
}, dependencies: {
  query?: typeof queryReferenceResourceEntries;
} = {}) {
  const query = dependencies.query ?? queryReferenceResourceEntries;
  const encoder = new TextEncoder();
  let cursor: string | null = null;
  let headerSent = false;
  let complete = false;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (complete) {
        controller.close();
        return;
      }
      try {
        if (!headerSent) {
          const header = input.resourceKey === COUNTRY_RESOURCE_KEY
            ? serializeCountryCsvRows([])
            : input.resourceKey === ROP_RESOURCE_KEY
              ? serializeRopCsvRows([])
              : serializePipelineResourceCsv(input.resourceKey, []);
          controller.enqueue(encoder.encode(header));
          headerSent = true;
          return;
        }
        const page = await query({
          resourceKey: input.resourceKey,
          search: input.search,
          cursor,
          limit: MAX_PAGE_SIZE,
        });
        const rows = input.resourceKey === COUNTRY_RESOURCE_KEY
          ? serializeCountryCsvRows(page.entries as IsoCountryCodeEntry[], { includeHeader: false })
          : input.resourceKey === ROP_RESOURCE_KEY
            ? serializeRopCsvRows(page.entries as RopCodeEntry[], { includeHeader: false })
            : serializePipelineResourceCsv(input.resourceKey, page.entries as never)
                .split("\n")
                .slice(1)
                .join("\n");
        if (rows) controller.enqueue(encoder.encode(rows));
        cursor = page.nextCursor;
        if (!cursor) complete = true;
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

export async function getCurrentReferenceResourceSet() {
  const [set] = await getDb()
    .select()
    .from(referenceResourceSets)
    .orderBy(desc(referenceResourceSets.sequenceNumber))
    .limit(1);
  if (!set) return null;
  const members = await getDb()
    .select()
    .from(referenceResourceSetMembers)
    .where(eq(referenceResourceSetMembers.setId, set.id));
  return { ...set, members };
}

export async function getReferenceResourceSet(setId: string) {
  const [set] = await getDb()
    .select()
    .from(referenceResourceSets)
    .where(eq(referenceResourceSets.id, setId))
    .limit(1);
  if (!set) return null;
  const members = await getDb()
    .select()
    .from(referenceResourceSetMembers)
    .where(eq(referenceResourceSetMembers.setId, set.id));
  return { ...set, members };
}

export async function checkReferenceResourceHealth(
  dependencies: { artifactStore?: ArtifactStore } = {},
): Promise<ReferenceResourceHealth> {
  const artifactStore = dependencies.artifactStore ?? defaultArtifactStore;
  const catalog = await listReferenceResourceCatalog();
  const currentSet = await getCurrentReferenceResourceSet();
  const members = new Map(
    currentSet?.members.map((member) => [member.resourceId, member.versionId]) ?? [],
  );
  const resources = [];
  for (const item of catalog) {
    const problems: string[] = [];
    if (!item.activeVersion) {
      problems.push("missing-active-version");
    } else {
      const record = await getVersionRecord(item.activeVersion.id);
      if (!record || record.lifecycleState !== "valid") problems.push("active-version-not-valid");
      if (record?.normalizedResource) {
        try {
          const expectedChecksum = isPipelineResourceKey(item.resourceKey)
            ? preparePipelineResource(
                item.resourceKey,
                record.normalizedResource,
              ).contentChecksum
            : checksumReferenceResource(record.normalizedResource);
          if (record.contentChecksum !== expectedChecksum) {
            problems.push("active-checksum-mismatch");
          }
        } catch {
          problems.push("active-payload-invalid");
        }
      }
      const artifactPaths = Object.values(record?.artifactManifest ?? {});
      if (artifactPaths.length < 5) problems.push("artifact-manifest-incomplete");
      for (const path of artifactPaths) {
        if (!(await artifactStore.exists(path))) problems.push(`missing-artifact:${path}`);
      }
      if (record) {
        if (item.resourceKey === COUNTRY_RESOURCE_KEY) {
          const [{ projectionCount }] = await getDb()
            .select({ projectionCount: count() })
            .from(countryReferenceEntries)
            .where(eq(countryReferenceEntries.versionId, record.id));
          if (projectionCount !== record.entryCount) problems.push("country-projection-count-mismatch");
        } else if (item.resourceKey === ROP_RESOURCE_KEY) {
          const [[{ peopleCount }], [{ termCount }], [{ geographyCount }]] = await Promise.all([
            getDb().select({ peopleCount: count() }).from(ropReferencePeople).where(eq(ropReferencePeople.versionId, record.id)),
            getDb().select({ termCount: count() }).from(ropReferenceTerms).where(eq(ropReferenceTerms.versionId, record.id)),
            getDb().select({ geographyCount: count() }).from(ropReferenceGeographies).where(eq(ropReferenceGeographies.versionId, record.id)),
          ]);
          const metadata = record.sourceMetadata as Record<string, unknown>;
          const expectedTerms = ["rop1Count", "rop2Count", "rop25Count", "rop3Count"]
            .reduce((total, key) => total + Number(metadata[key] ?? 0), 0);
          if (peopleCount !== record.entryCount) problems.push("rop-people-count-mismatch");
          if (termCount !== expectedTerms) problems.push("rop-term-count-mismatch");
          if (geographyCount !== Number(metadata.geoIndexCount ?? 0)) problems.push("rop-geography-count-mismatch");
        } else {
          const [{ projectionCount }] = await getDb()
            .select({ projectionCount: count() })
            .from(pipelineReferenceEntries)
            .where(eq(pipelineReferenceEntries.versionId, record.id));
          if (projectionCount !== record.entryCount) {
            problems.push("pipeline-projection-count-mismatch");
          }
        }
      }
      if (members.get(item.id) !== item.activeVersion.id) problems.push("current-set-mismatch");
    }
    const [staleBuild] = await getDb()
      .select({ id: referenceResourceVersions.id })
      .from(referenceResourceVersions)
      .where(and(
        eq(referenceResourceVersions.resourceId, item.id),
        eq(referenceResourceVersions.lifecycleState, "building"),
        lt(referenceResourceVersions.createdAt, new Date(Date.now() - 30 * 60 * 1000)),
      ))
      .limit(1);
    if (staleBuild) problems.push("stale-building-version");
    resources.push({
      resourceKey: item.resourceKey,
      healthy: problems.length === 0,
      activeVersionId: item.activeVersion?.id ?? null,
      problems,
    });
  }
  return {
    healthy: resources.every((item) => item.healthy),
    resources,
    currentSetId: currentSet?.id ?? null,
  };
}

export async function deriveAndActivateCountryAliases(input: {
  displayName: string;
  alternativeNames: string[];
  actorOwnerId: string;
}) {
  const active = await getActiveReferenceResource(COUNTRY_RESOURCE_KEY);
  const payload = active.payload;
  const entry = payload.entries.find((item) => item.displayName === input.displayName);
  if (!entry) return null;
  const normalized = Array.from(
    new Map(
      input.alternativeNames
        .map((name) => name.trim())
        .filter(Boolean)
        .filter((name) => name.toLocaleLowerCase() !== entry.displayName.toLocaleLowerCase())
        .map((name) => [name.toLocaleLowerCase(), name]),
    ).values(),
  );
  if (canonicalizeReferenceResource(normalized) === canonicalizeReferenceResource(entry.alternativeNames)) {
    return { entry, resource: payload, version: active.version };
  }
  const nextPayload: IsoCountryCodeResource = {
    ...payload,
    sourceRetrievedAt: new Date().toISOString(),
    entries: payload.entries.map((item) =>
      item.displayName === entry.displayName ? { ...item, alternativeNames: normalized } : item,
    ),
  };
  const candidate = await createReferenceResourceCandidate({
    resourceKey: COUNTRY_RESOURCE_KEY,
    payload: nextPayload,
    actorOwnerId: input.actorOwnerId,
    rawManifest: { operation: "alias-edit", displayName: input.displayName },
  });
  await activateReferenceResource({
    resourceKey: COUNTRY_RESOURCE_KEY,
    versionId: candidate.version.id,
    expectedActiveVersionId: active.version.id,
    actorOwnerId: input.actorOwnerId,
    reason: `Update aliases for ${input.displayName}`,
    action: "alias-edit",
  });
  const updated = await getActiveReferenceResource(COUNTRY_RESOURCE_KEY);
  return {
    entry: updated.payload.entries.find((item) => item.displayName === input.displayName)!,
    resource: updated.payload,
    version: updated.version,
  };
}

export { COUNTRY_RESOURCE_KEY, ROP_RESOURCE_KEY } from "./types";
export {
  loadPinnedPipelineReferenceResource,
  loadPinnedPipelineReferenceResources,
  loadPinnedTier1PriorityRules,
  PinnedPipelineResourceError,
  validatePinnedPipelineResourceRecord,
} from "./pinned-runtime";
export type * from "./types";
export type * from "./pinned-runtime";
