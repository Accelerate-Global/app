import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  executeApiConnectionRun,
  getApiConnectionRunDetail,
  startApiConnectionRun,
} from "@/lib/api-connections";
import { parseApiConnectionRowsArtifact } from "@/lib/api-connection-output";
import type { CurrentIdentity } from "@/lib/auth";
import {
  createDatasetFormingPublicationManifest,
  createDatasetFormingPublicationRowBatches,
  checksumDatasetFormingValue,
  readDatasetFormingArtifact,
} from "@/lib/dataset-forming";
import {
  executeImbFormingRun,
  publishImbFormingRun,
  rejectImbFormingRun,
  startImbFormingRun,
} from "@/lib/imb-forming";
import {
  buildAxIdentityCandidate,
  publishAxIdentityCandidate,
  rejectAxIdentityCandidate,
} from "@/lib/identity-registry";
import {
  buildPipelineProduct,
  createPipelineReleaseSetCandidate,
  finalizePipelineReleaseSetCandidate,
  publishPipelineRun,
  rejectPipelineReleaseSetCandidate,
  rejectPipelineRun,
} from "@/lib/pipeline-products";
import type { Tier1ReleaseInputKey } from "@/lib/pipeline-products";
import type { Tier1PriorityRule } from "@/lib/tier1-products";
import { resolveSourceProfile } from "@/lib/source-profiles";
import {
  runAggregate2Stage,
  runTier2FormingPublicationStage,
  runTier2FormingStage,
  runTier2IdentityPublicationStage,
  runTier2IdentityStage,
  runTier2MergeStage,
  runTier2PublishStage,
  runTier2ReleaseStage,
  refreshTier2PartnerProfileSheetTitleFromConnection,
  rejectTier2PartnerFormingCandidate,
  rejectTier2PartnerIdentityCandidate,
  rejectTier2ProductRun,
} from "@/lib/tier2-products";

import { PipelineStageExecutionError } from "./executor";
import { getPipelineFlowDefinition } from "./registry";
import { parseExactReferenceResourceSnapshot } from "./resource-pins";
import {
  getPinnedPipelineSourceExecutionBinding,
  resolveCurrentPipelineSourceExecutionBinding,
} from "./source-execution";
import type {
  PipelineJsonObject,
  PipelineStageHandler,
  PipelineStageHandlers,
  PipelineRunDetail,
} from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getCoordinator(input: PipelineJsonObject) {
  return asRecord(input.coordinator);
}

function identityForClaim(claim: {
  actorOwnerId: string;
  actorEmail: string | null;
}): CurrentIdentity {
  return {
    ownerId: claim.actorOwnerId,
    email: claim.actorEmail,
    fullName: null,
    workspaceRole: "admin",
    isDatasetAdmin: true,
    mode: "supabase",
  };
}

function getSourceProfileKey(input: PipelineJsonObject) {
  const key = getCoordinator(input).sourceProfileKey;
  return typeof key === "string" && key ? key : null;
}

function getConnectionId(input: PipelineJsonObject, sourceProfileKey: string) {
  if (sourceProfileKey === "tier2-partner") {
    const profileId = typeof input.profileId === "string" ? input.profileId : null;
    const profiles = asRecord(input.tier2ProfileBindings);
    for (const value of Object.values(profiles)) {
      const profile = asRecord(value);
      if (profile.id === profileId && typeof profile.connectionId === "string") {
        return profile.connectionId;
      }
    }
    return null;
  }
  const connectionIds = asRecord(input.connectionIds);
  const value = connectionIds[sourceProfileKey];
  return typeof value === "string" ? value : null;
}

function getPinnedSourceArtifactValue(
  input: PipelineJsonObject,
  sourceProfileKey: string,
  singularKey: "sourceRunId" | "sourceChecksum",
  mapKey: "sourceRunIds" | "sourceChecksums",
) {
  const mapped = asRecord(input[mapKey])[sourceProfileKey];
  if (typeof mapped === "string" && mapped) return mapped;
  const singular = input[singularKey];
  return typeof singular === "string" && singular ? singular : null;
}

function getPinnedResourceBinding(input: PipelineJsonObject, resourceKey: string) {
  return asRecord(asRecord(input.referenceVersionBindings)[resourceKey]);
}

function getPinnedRegistryRevision(input: PipelineJsonObject) {
  return asRecord(input.registryRevision);
}

function getPinnedSourceProfile(input: PipelineJsonObject, sourceProfileKey: string) {
  return asRecord(asRecord(input.sourceProfileBindings)[sourceProfileKey]);
}

const SOURCE_SEMANTIC_DEPENDENCY_KINDS = new Set([
  "source-engine",
  "source-adapter",
  "field-contract",
  "transformation-contract",
]);

function sourceSemanticDependencies(
  sourceProfileKey: string,
  dependencies: readonly unknown[],
) {
  const sourceDefinition = getPipelineFlowDefinition(
    sourceProfileKey === "tier2-partner"
      ? "tier2-partner"
      : `source-${sourceProfileKey}`,
  );
  if (!sourceDefinition) return null;
  const sourceDependencyIdentities = new Set(
    sourceDefinition.semanticDependencies
      .filter((dependency) =>
        SOURCE_SEMANTIC_DEPENDENCY_KINDS.has(dependency.kind)
      )
      .map((dependency) => `${dependency.kind}:${dependency.key}`),
  );
  return dependencies
    .map(asRecord)
    .filter((dependency) =>
      typeof dependency.kind === "string" &&
      typeof dependency.key === "string" &&
      sourceDependencyIdentities.has(
        `${dependency.kind}:${dependency.key}`,
      )
    );
}

async function requirePinnedSourceProfile(input: {
  exactInputs: PipelineJsonObject;
  definitionKey: string;
  sourceProfileKey: string;
  connectionId: string;
}) {
  const pinnedDefinition = asRecord(input.exactInputs.pipelineDefinition);
  const currentDefinition = getPipelineFlowDefinition(input.definitionKey);
  const pinnedDependencies = Array.isArray(pinnedDefinition.semanticDependencies)
    ? pinnedDefinition.semanticDependencies
    : [];
  const pinnedSourceDependencies = sourceSemanticDependencies(
    input.sourceProfileKey,
    pinnedDependencies,
  );
  const currentSourceDependencies = sourceSemanticDependencies(
    input.sourceProfileKey,
    currentDefinition?.semanticDependencies ?? [],
  );
  const pinnedDependencyChecksum = checksumDatasetFormingValue(
    pinnedSourceDependencies,
  );
  const currentDependencyChecksum = checksumDatasetFormingValue(
    currentSourceDependencies,
  );
  if (
    pinnedDefinition.key !== input.definitionKey ||
    pinnedDefinition.checksum !== currentDefinition?.checksum ||
    !pinnedSourceDependencies ||
    !currentSourceDependencies ||
    pinnedDependencyChecksum !== currentDependencyChecksum
  ) {
    throw new PipelineStageExecutionError(
      "The source-engine contract changed after this flow was launched. Rebuild with current inputs.",
      { code: "source-engine-contract-stale", retryable: false },
    );
  }
  const pinned = getPinnedSourceProfile(input.exactInputs, input.sourceProfileKey);
  if (Object.keys(pinned).length === 0) {
    if (input.sourceProfileKey !== "tier2-partner") {
      throw new PipelineStageExecutionError(
        `No immutable source-profile configuration was pinned for ${input.sourceProfileKey}.`,
        { code: "source-profile-binding-missing", retryable: false },
      );
    }
  }
  let resolvedProfile: {
    connectionId: string;
    profileKey: string;
    engineKey: string;
    stableKeyColumn: string | null;
    configurable: boolean;
    checksum: string;
  } | null = null;
  if (input.sourceProfileKey !== "tier2-partner") {
    const current = await resolveSourceProfile(input.connectionId);
    if (!current) {
      throw new PipelineStageExecutionError(
        "The pinned source-profile configuration is no longer available.",
        { code: "source-profile-binding-stale", retryable: false },
      );
    }
    const currentBinding = {
      connectionId: input.connectionId,
      profileKey: current.key,
      engineKey: current.engineKey,
      stableKeyColumn: current.stableKeyColumn,
      configurable: current.configurable,
    };
    const currentChecksum = checksumDatasetFormingValue(currentBinding);
    if (
      pinned.connectionId !== input.connectionId ||
      pinned.profileKey !== current.key ||
      pinned.engineKey !== current.engineKey ||
      pinned.stableKeyColumn !== current.stableKeyColumn ||
      pinned.configurable !== current.configurable ||
      pinned.checksum !== currentChecksum
    ) {
      throw new PipelineStageExecutionError(
        "The source-profile configuration changed after this flow was launched. Rebuild with current inputs.",
        { code: "source-profile-binding-stale", retryable: false },
      );
    }
    resolvedProfile = { ...currentBinding, checksum: currentChecksum };
  }

  const pinnedExecution = getPinnedPipelineSourceExecutionBinding({
    exactInputs: input.exactInputs,
    sourceProfileKey: input.sourceProfileKey,
    connectionId: input.connectionId,
  });
  const currentExecution = await resolveCurrentPipelineSourceExecutionBinding({
    sourceProfileKey: input.sourceProfileKey,
    connectionId: input.connectionId,
  });
  if (
    !currentExecution ||
    pinnedExecution.configChecksum !== currentExecution.configChecksum ||
    pinnedExecution.adapterKey !== currentExecution.adapterKey ||
    pinnedExecution.adapterVersion !== currentExecution.adapterVersion ||
    pinnedExecution.adapterChecksum !== currentExecution.adapterChecksum ||
    pinnedExecution.checksum !== currentExecution.checksum
  ) {
    throw new PipelineStageExecutionError(
      "The source execution configuration changed after this flow was launched. Rebuild with current inputs.",
      { code: "source-execution-config-stale", retryable: false },
    );
  }
  return resolvedProfile;
}

function findUpstreamOutput(
  input: PipelineJsonObject,
  predicate: (value: Record<string, unknown>) => boolean,
) {
  const upstream = asRecord(input.upstreamOutputs);
  for (const value of Object.values(upstream)) {
    const record = asRecord(value);
    if (predicate(record)) return record;
  }
  return null;
}

function findLatestUpstreamOutput(
  input: PipelineJsonObject,
  predicate: (value: Record<string, unknown>) => boolean,
) {
  const matches = Object.values(asRecord(input.upstreamOutputs))
    .map(asRecord)
    .filter(predicate);
  return matches.at(-1) ?? null;
}

function getUpstreamOutput(input: PipelineJsonObject, stageKey: string) {
  return asRecord(asRecord(input.upstreamOutputs)[stageKey]);
}

function requiredText(
  value: unknown,
  message: string,
  code: string,
) {
  if (typeof value === "string" && value.trim()) return value;
  throw new PipelineStageExecutionError(message, { code, retryable: false });
}

function reviewReason(input: PipelineJsonObject, reviewStageKey: string) {
  const review = getUpstreamOutput(input, reviewStageKey);
  if (review.reviewDecision !== "approve") {
    throw new PipelineStageExecutionError(
      "The publication stage has no explicit approved review decision.",
      { code: "publication-review-missing", retryable: false },
    );
  }
  return requiredText(
    review.reviewReason,
    "The approved review gate has no publication reason.",
    "publication-reason-missing",
  );
}

function warningsAcknowledged(
  input: PipelineJsonObject,
  reviewStageKey: string,
) {
  return getUpstreamOutput(input, reviewStageKey).warningsAcknowledged === true;
}

async function ensureDatasetFormingPublication(input: {
  formingRun: Awaited<ReturnType<typeof publishImbFormingRun>>;
  reason: string;
  identity: CurrentIdentity;
}) {
  if (input.formingRun.publicationId) {
    return input.formingRun.publicationId;
  }
  const existing = (await getDb().execute(sql<{ id: string }>`
    select id from private.pipeline_publications
    where producer_kind = 'dataset-forming'
      and producer_run_id = ${input.formingRun.id}::uuid
    limit 1
  `)) as unknown as { id: string }[];
  if (existing[0]) {
    await getDb().execute(sql`
      update private.dataset_forming_runs
      set publication_id = ${existing[0].id}::uuid
      where id = ${input.formingRun.id}::uuid and publication_id is null
    `);
    return existing[0].id;
  }

  const rowsPath = input.formingRun.artifactManifest.rows;
  if (
    !rowsPath ||
    !input.formingRun.datasetId ||
    !input.formingRun.outputChecksum ||
    input.formingRun.outputRowCount === null
  ) {
    throw new PipelineStageExecutionError(
      "The published formed dataset is missing immutable publication evidence.",
      { code: "forming-publication-evidence-missing", retryable: false },
    );
  }
  const parsed = parseApiConnectionRowsArtifact(
    await readDatasetFormingArtifact(rowsPath),
  );
  if (parsed.rows.length !== input.formingRun.outputRowCount) {
    throw new PipelineStageExecutionError(
      "The formed dataset row archive no longer matches its published count.",
      { code: "forming-publication-row-mismatch", retryable: false },
    );
  }

  return getDb().transaction(async (tx) => {
    const inserted = (await tx.execute(sql<{ id: string }>`
      insert into private.pipeline_publications (
        producer_kind, producer_run_id, dataset_id, source_profile_key,
        registry_revision_id, output_checksum, row_count, artifact_manifest,
        actor_owner_id, actor_email, reason, publication_target_key,
        producer_definition_key, release_set_id
      ) values (
        'dataset-forming', ${input.formingRun.id}::uuid,
        ${input.formingRun.datasetId}::uuid, ${input.formingRun.sourceProfileKey},
        null, ${input.formingRun.outputChecksum}, ${parsed.rows.length},
        ${JSON.stringify(createDatasetFormingPublicationManifest({
          schemaVersion: input.formingRun.artifactSchemaVersion,
          formingRunId: input.formingRun.id,
          sourceRunId: input.formingRun.sourceRunId,
          resourceSetId: input.formingRun.resourceSetId,
          inputFingerprint: input.formingRun.inputFingerprint,
          artifacts: input.formingRun.artifactManifest,
        }))}::jsonb,
        ${input.identity.ownerId}, ${input.identity.email}, ${input.reason},
        ${input.formingRun.publicationTargetKey}, ${input.formingRun.engineKey}, null
      )
      on conflict (producer_kind, producer_run_id) do nothing
      returning id
    `)) as unknown as { id: string }[];
    let publicationId = inserted[0]?.id;
    if (!publicationId) {
      const retained = (await tx.execute(sql<{ id: string }>`
        select id from private.pipeline_publications
        where producer_kind = 'dataset-forming'
          and producer_run_id = ${input.formingRun.id}::uuid
        limit 1
      `)) as unknown as { id: string }[];
      publicationId = retained[0]?.id;
    }
    if (!publicationId) {
      throw new Error("The immutable source publication could not be resolved.");
    }
    if (inserted[0]) {
      for (const { offset, rows: batch } of
        createDatasetFormingPublicationRowBatches(parsed.rows)) {
        await tx.execute(sql`
          insert into private.pipeline_publication_rows (
            publication_id, row_index, data
          )
          select ${publicationId}::uuid,
            (${offset} + ordinal - 1)::integer,
            value
          from jsonb_array_elements(${JSON.stringify(batch)}::jsonb)
            with ordinality as entry(value, ordinal)
        `);
      }
    }
    await tx.execute(sql`
      update private.dataset_forming_runs
      set publication_id = ${publicationId}::uuid
      where id = ${input.formingRun.id}::uuid
        and publication_id is null
    `);
    return publicationId;
  });
}

export const runSourceIngestionStage: PipelineStageHandler = async ({
  claim,
  reportProgress,
}) => {
  const sourceProfileKey = getSourceProfileKey(claim.exactInputs);
  if (!sourceProfileKey) {
    throw new PipelineStageExecutionError("The source stage has no pinned source profile.", {
      code: "source-profile-missing",
      retryable: false,
    });
  }
  const connectionId = getConnectionId(claim.exactInputs, sourceProfileKey);
  if (!connectionId) {
    throw new PipelineStageExecutionError(
      `No exact API connection was pinned for ${sourceProfileKey}.`,
      { code: "source-connection-missing", retryable: false },
    );
  }
  await requirePinnedSourceProfile({
    exactInputs: claim.exactInputs,
    definitionKey: claim.definitionKey,
    sourceProfileKey,
    connectionId,
  });

  await reportProgress(0, 1);
  const pinnedSourceRunId = getPinnedSourceArtifactValue(
    claim.exactInputs,
    sourceProfileKey,
    "sourceRunId",
    "sourceRunIds",
  );
  const pinnedSourceChecksum = getPinnedSourceArtifactValue(
    claim.exactInputs,
    sourceProfileKey,
    "sourceChecksum",
    "sourceChecksums",
  );
  let sourceRun = pinnedSourceRunId
    ? await getApiConnectionRunDetail({
        connectionId,
        runId: pinnedSourceRunId,
      })
    : null;

  if (!pinnedSourceRunId) {
    const started = await startApiConnectionRun({
      connectionId,
      importEnabled: true,
      operationKey: `pipeline:${claim.flowRunId}:${claim.stageKey}`,
      identity: {
        ...identityForClaim(claim),
      },
    });
    if (!started) {
      throw new PipelineStageExecutionError("The pinned API connection was not found.", {
        code: "source-connection-not-found",
        retryable: false,
      });
    }
    const executed = started.run.status === "success"
      ? started
      : await executeApiConnectionRun({ runId: started.run.id });
    sourceRun = executed?.run ?? null;
  }

  if (!sourceRun || sourceRun.status !== "success") {
    throw new PipelineStageExecutionError(
      pinnedSourceRunId
        ? "The pinned historical source run is unavailable or did not complete successfully."
        : "The source ingestion did not complete. Protected run logs contain the provider details.",
      {
        code: pinnedSourceRunId
          ? "historical-source-run-unavailable"
          : "source-ingestion-failed",
        retryable: !pinnedSourceRunId,
      },
    );
  }
  const sourceChecksum = sourceRun.output?.rowsChecksum;
  if (!sourceChecksum || !/^[0-9a-f]{64}$/u.test(sourceChecksum)) {
    throw new PipelineStageExecutionError(
      "The successful source run is missing its immutable rows checksum.",
      { code: "source-artifact-checksum-missing", retryable: false },
    );
  }
  if (pinnedSourceChecksum && pinnedSourceChecksum !== sourceChecksum) {
    throw new PipelineStageExecutionError(
      "The archived source run checksum does not match the exact backfill pin.",
      { code: "historical-source-checksum-mismatch", retryable: false },
    );
  }
  let sheetTitle: string | null = null;
  if (sourceProfileKey === "tier2-partner" && !pinnedSourceRunId) {
    const profileId =
      typeof claim.exactInputs.profileId === "string"
        ? claim.exactInputs.profileId
        : null;
    if (!profileId) {
      throw new PipelineStageExecutionError(
        "The Tier 2 ingestion has no exact partner profile.",
        { code: "tier2-profile-missing", retryable: false },
      );
    }
    const refreshedProfile =
      await refreshTier2PartnerProfileSheetTitleFromConnection({
        profileId,
        connectionId,
      });
    sheetTitle = refreshedProfile.sheetTitle;
  }
  await reportProgress(1, 1);
  return {
    outcome: "succeeded",
    rowCount: sourceRun.rowCount,
    output: {
      sourceProfileKey,
      connectionId,
      apiConnectionRunId: sourceRun.id,
      sourceChecksum,
      rowCount: sourceRun.rowCount,
      datasetId: sourceRun.datasetId,
      ...(sheetTitle ? { sheetTitle } : {}),
    },
  };
};

export const runSourceFormingStage: PipelineStageHandler = async ({
  claim,
  reportProgress,
}) => {
  const sourceProfileKey = getSourceProfileKey(claim.exactInputs);
  if (!sourceProfileKey) {
    throw new PipelineStageExecutionError("The forming stage has no pinned source profile.", {
      code: "source-profile-missing",
      retryable: false,
    });
  }
  const ingestion = findUpstreamOutput(
    claim.exactInputs,
    (output) => output.sourceProfileKey === sourceProfileKey && typeof output.apiConnectionRunId === "string",
  );
  const connectionId = typeof ingestion?.connectionId === "string" ? ingestion.connectionId : null;
  const sourceRunId = typeof ingestion?.apiConnectionRunId === "string"
    ? ingestion.apiConnectionRunId
    : null;
  if (!connectionId || !sourceRunId) {
    throw new PipelineStageExecutionError(
      "The forming stage could not resolve the exact successful ingestion output.",
      { code: "forming-source-output-missing", retryable: false },
    );
  }

  const sourceProfileBinding = await requirePinnedSourceProfile({
    exactInputs: claim.exactInputs,
    definitionKey: claim.definitionKey,
    sourceProfileKey,
    connectionId,
  });

  await reportProgress(0, 1);
  const resourceSetId = requiredText(
    claim.exactInputs.resourceSetId,
    "The forming stage has no exact reference resource set.",
    "forming-resource-set-missing",
  );
  let expectedResourceSnapshot;
  try {
    const exactResources = parseExactReferenceResourceSnapshot(
      claim.exactInputs,
    );
    expectedResourceSnapshot = {
      resourceSetChecksum: exactResources.resourceSetChecksum,
      referenceVersionBindings: exactResources.referenceVersionBindings,
    };
  } catch (error) {
    throw new PipelineStageExecutionError(
      error instanceof Error
        ? error.message
        : "The forming stage has invalid exact reference bindings.",
      { code: "forming-resource-snapshot-invalid", retryable: false },
    );
  }
  const formingPublicationPins = asRecord(
    claim.exactInputs.formingPublicationIds,
  );
  if (!(sourceProfileKey in formingPublicationPins)) {
    throw new PipelineStageExecutionError(
      "The forming stage has no launch-pinned prior publication target.",
      { code: "forming-target-pin-missing", retryable: false },
    );
  }
  const expectedCurrentPublicationId =
    formingPublicationPins[sourceProfileKey];
  if (
    expectedCurrentPublicationId !== null &&
    typeof expectedCurrentPublicationId !== "string"
  ) {
    throw new PipelineStageExecutionError(
      "The forming stage has an invalid launch-pinned publication target.",
      { code: "forming-target-pin-invalid", retryable: false },
    );
  }
  const forming = await startImbFormingRun({
    connectionId,
    sourceRunId,
    resourceSetId,
    expectedSourceProfile: sourceProfileBinding ?? undefined,
    expectedResourceSnapshot,
    expectedCurrentPublicationId,
    identity: {
      ...identityForClaim(claim),
    },
  });
  const completed = forming.status === "building"
    ? await executeImbFormingRun(forming.id)
    : forming;
  if (!completed) {
    throw new PipelineStageExecutionError(
      "The formed candidate disappeared before it could be completed.",
      { code: "forming-candidate-missing", retryable: true },
    );
  }
  if (completed.status === "failed") {
    throw new PipelineStageExecutionError(
      "The formed candidate build failed. Protected run logs contain the diagnostic details.",
      { code: "forming-build-failed", retryable: true },
    );
  }
  await reportProgress(1, 1);
  return {
    outcome: "succeeded",
    rowCount: completed.outputRowCount,
    output: {
      sourceProfileKey,
      connectionId,
      apiConnectionRunId: sourceRunId,
      formingRunId: completed.id,
      candidateStatus: completed.status,
      outputChecksum: completed.outputChecksum,
      resourceSetId: completed.resourceSetId,
    },
    findingSummary: {
      warningCount: completed.validationSummary.warningCount,
      errorCount: completed.validationSummary.errorCount,
    },
  };
};

export const runSourcePublicationStage: PipelineStageHandler = async ({
  claim,
  reportProgress,
}) => {
  const sourceProfileKey = getSourceProfileKey(claim.exactInputs);
  if (!sourceProfileKey) {
    throw new PipelineStageExecutionError("The source publication has no source profile.", {
      code: "source-profile-missing",
      retryable: false,
    });
  }
  const formed = getUpstreamOutput(
    claim.exactInputs,
    `${sourceProfileKey}-form`,
  );
  const formingRunId = requiredText(
    formed.formingRunId,
    "The source publication cannot resolve its formed candidate.",
    "forming-candidate-missing",
  );
  const connectionId = requiredText(
    formed.connectionId,
    "The source publication cannot resolve its connection.",
    "source-connection-missing",
  );
  const sourceRunId = requiredText(
    formed.apiConnectionRunId,
    "The source publication cannot resolve its ingestion run.",
    "source-run-missing",
  );
  const reason = reviewReason(
    claim.exactInputs,
    `${sourceProfileKey}-review`,
  );
  const identity = identityForClaim(claim);
  await reportProgress(0, 2);
  const formingRun = await publishImbFormingRun({
    connectionId,
    sourceRunId,
    formingRunId,
    identity,
    decision: {
      reason,
      warningsAcknowledged: warningsAcknowledged(
        claim.exactInputs,
        `${sourceProfileKey}-review`,
      ),
    },
  });
  await reportProgress(1, 2);
  const publicationId = await ensureDatasetFormingPublication({
    formingRun,
    reason,
    identity,
  });
  await reportProgress(2, 2);
  return {
    outcome: "succeeded",
    rowCount: formingRun.outputRowCount,
    output: {
      sourceProfileKey,
      formingRunId,
      datasetId: formingRun.datasetId,
      publicationId,
      outputChecksum: formingRun.outputChecksum,
    },
  };
};

export const runIdentityReconciliationStage: PipelineStageHandler = async ({
  claim,
  reportProgress,
}) => {
  const sourceProfileKey = getSourceProfileKey(claim.exactInputs);
  if (!sourceProfileKey) {
    throw new PipelineStageExecutionError("The identity stage has no source profile.", {
      code: "source-profile-missing",
      retryable: false,
    });
  }
  const published = getUpstreamOutput(
    claim.exactInputs,
    `${sourceProfileKey}-publish`,
  );
  const sourcePublicationId = requiredText(
    published.publicationId,
    "The identity stage requires an exact published forming output.",
    "identity-source-publication-missing",
  );
  const country = getPinnedResourceBinding(
    claim.exactInputs,
    "country-territory-codes",
  );
  const rop = getPinnedResourceBinding(claim.exactInputs, "rop-codes");
  const registryRevision = getPinnedRegistryRevision(claim.exactInputs);
  const upstreamRevision = findLatestUpstreamOutput(
    claim.exactInputs,
    (output) => typeof output.registryRevisionId === "string",
  );
  const launchRevisionId = typeof claim.exactInputs.registryRevisionId === "string"
    ? claim.exactInputs.registryRevisionId
    : null;
  const baseRevisionId = typeof upstreamRevision?.registryRevisionId === "string"
    ? upstreamRevision.registryRevisionId
    : launchRevisionId;
  await reportProgress(0, 1);
  const candidate = await buildAxIdentityCandidate({
    sourcePublicationId,
    identity: identityForClaim(claim),
    countryVersionId: requiredText(
      country.versionId,
      "The identity stage has no exact Country reference version.",
      "identity-country-version-missing",
    ),
    countryChecksum: requiredText(
      country.checksum,
      "The identity stage has no Country reference checksum.",
      "identity-country-checksum-missing",
    ),
    ropVersionId: requiredText(
      rop.versionId,
      "The identity stage has no exact ROP reference version.",
      "identity-rop-version-missing",
    ),
    ropChecksum: requiredText(
      rop.checksum,
      "The identity stage has no ROP reference checksum.",
      "identity-rop-checksum-missing",
    ),
    baseRevisionId,
    baseRevisionChecksum:
      baseRevisionId === launchRevisionId &&
      typeof registryRevision.checksum === "string"
        ? registryRevision.checksum
        : undefined,
  });
  if (!candidate) {
    throw new PipelineStageExecutionError("The identity candidate could not be loaded.", {
      code: "identity-candidate-missing",
      retryable: true,
    });
  }
  if (candidate.status === "failed") {
    throw new PipelineStageExecutionError(
      "The identity candidate build failed.",
      { code: "identity-build-failed", retryable: true },
    );
  }
  await reportProgress(1, 1);
  return {
    outcome: "succeeded",
    rowCount: candidate.outputRowCount,
    output: {
      sourceProfileKey,
      sourcePublicationId,
      identityRunId: candidate.id,
      candidateStatus: candidate.status,
    },
    findingSummary: {
      warningCount: candidate.warningCount,
      errorCount: candidate.errorCount,
    },
  };
};

export const runIdentityPublicationStage: PipelineStageHandler = async ({
  claim,
  reportProgress,
}) => {
  const sourceProfileKey = getSourceProfileKey(claim.exactInputs);
  if (!sourceProfileKey) {
    throw new PipelineStageExecutionError("The identity publication has no source profile.", {
      code: "source-profile-missing",
      retryable: false,
    });
  }
  const candidate = getUpstreamOutput(
    claim.exactInputs,
    `${sourceProfileKey}-identity`,
  );
  const identityRunId = requiredText(
    candidate.identityRunId,
    "The identity publication cannot resolve its candidate.",
    "identity-candidate-missing",
  );
  const reason = reviewReason(
    claim.exactInputs,
    `${sourceProfileKey}-identity-review`,
  );
  await reportProgress(0, 1);
  const published = await publishAxIdentityCandidate({
    runId: identityRunId,
    reason,
    identity: identityForClaim(claim),
  });
  await reportProgress(1, 1);
  return {
    outcome: "succeeded",
    output: {
      sourceProfileKey,
      identityRunId,
      registryRevisionId: published.revisionId,
      publicationId: published.publicationId,
      datasetId: published.datasetId,
    },
  };
};

const aggregateParentByProduct: Readonly<Record<string, string>> = Object.freeze({
  "aggregate1-pgac": "tier1-specific-pg-merge",
  "aggregate1-self-engaged": "aggregate1-pgac",
  "aggregate1-watchlist": "aggregate1-pgac",
  "aggregate1-baseline-uupg": "aggregate1-watchlist",
  "aggregate1-hotspots": "aggregate1-baseline-uupg",
  "aggregate1-south-asia": "aggregate1-pgac",
});

const tier1SourceInputs = Object.freeze([
  ["ax", "accelerate-owned-people-groups"],
  ["etno", "etnopedia-people-groups"],
  ["imb", "imb-people-groups"],
  ["jp", "joshua-project-pgic"],
  ["wcd", "wcd-people-groups"],
] as const satisfies readonly (readonly [Tier1ReleaseInputKey, string])[]);

export const runTier1ReleaseSetStage: PipelineStageHandler = async ({
  claim,
  reportProgress,
}) => {
  const exactPublicationIds = asRecord(claim.exactInputs.publicationIds);
  const upstream = asRecord(claim.exactInputs.upstreamOutputs);
  const selections: Array<{
    inputKey: Tier1ReleaseInputKey;
    publicationId: string;
    expectedChecksum: string;
  }> = [];

  for (const [inputKey, sourceProfileKey] of tier1SourceInputs) {
    const publishedIdentity = asRecord(
      upstream[`${sourceProfileKey}-identity-publish`],
    );
    const publicationId = requiredText(
      publishedIdentity.publicationId ?? exactPublicationIds[sourceProfileKey],
      `The Tier 1 release is missing the exact ${inputKey.toUpperCase()} identity publication.`,
      "release-publication-missing",
    );
    const rows = (await getDb().execute(sql<{
      outputChecksum: string;
      producerKind: string;
    }>`
      select output_checksum as "outputChecksum", producer_kind as "producerKind"
      from private.pipeline_publications
      where id = ${publicationId}::uuid
      limit 1
    `)) as unknown as Array<{ outputChecksum: string; producerKind: string }>;
    if (!rows[0] || rows[0].producerKind !== "identity") {
      throw new PipelineStageExecutionError(
        `The selected ${inputKey.toUpperCase()} input is not an identity publication.`,
        { code: "release-publication-incompatible", retryable: false },
      );
    }
    selections.push({
      inputKey,
      publicationId,
      expectedChecksum: rows[0].outputChecksum,
    });
  }

  const resourceSetId = requiredText(
    claim.exactInputs.resourceSetId,
    "The Tier 1 release has no exact reference resource set.",
    "release-resource-set-missing",
  );
  const finalIdentityPublication = getUpstreamOutput(
    claim.exactInputs,
    "accelerate-owned-people-groups-identity-publish",
  );
  const registryRevisionId = requiredText(
    finalIdentityPublication.registryRevisionId ?? claim.exactInputs.registryRevisionId,
    "The Tier 1 release has no exact AX registry revision.",
    "release-registry-revision-missing",
  );
  const ruleBinding = asRecord(claim.exactInputs.tier1RuleBinding);
  const ruleVersion = requiredText(
    ruleBinding.version,
    "The Tier 1 release has no exact rule version.",
    "release-rule-version-missing",
  );
  const ruleChecksum = requiredText(
    ruleBinding.checksum,
    "The Tier 1 release has no exact rule checksum.",
    "release-rule-checksum-missing",
  );
  if (!Array.isArray(ruleBinding.priorities)) {
    throw new PipelineStageExecutionError(
      "The Tier 1 release has no exact priority rule payload.",
      { code: "release-rule-payload-missing", retryable: false },
    );
  }
  await reportProgress(0, 1);
  const release = await createPipelineReleaseSetCandidate({
    releaseKey: `tier1-${claim.flowRunId}`,
    resourceSetId,
    registryRevisionId,
    ruleVersion,
    ruleChecksum,
    priorities: ruleBinding.priorities as Tier1PriorityRule[],
    members: selections,
    actorOwnerId: claim.actorOwnerId,
    actorEmail: claim.actorEmail,
  });
  await reportProgress(1, 1);
  return {
    outcome: "succeeded",
    output: {
      releaseSetId: release.id,
      registryRevisionId,
      resourceSetId,
      releaseChecksum: release.canonicalChecksum,
      candidateStatus: release.status,
    },
  };
};

export const runTier1ReleaseFinalizationStage: PipelineStageHandler = async ({
  claim,
  reportProgress,
}) => {
  const candidate = getUpstreamOutput(claim.exactInputs, "tier1-release-set");
  const releaseSetId = requiredText(
    candidate.releaseSetId,
    "The Tier 1 release finalization cannot resolve its reviewed candidate.",
    "release-candidate-missing",
  );
  const reason = reviewReason(claim.exactInputs, "tier1-release-review");
  await reportProgress(0, 1);
  const release = await finalizePipelineReleaseSetCandidate({
    releaseSetId,
    actorOwnerId: claim.actorOwnerId,
    actorEmail: claim.actorEmail,
    reason,
  });
  await reportProgress(1, 1);
  return {
    outcome: "succeeded",
    output: {
      releaseSetId: release.id,
      registryRevisionId: release.registryRevisionId,
      resourceSetId: release.resourceSetId,
      releaseChecksum: release.canonicalChecksum,
      candidateStatus: release.status,
    },
  };
};

export const runTier1ProductBuildStage: PipelineStageHandler = async ({
  claim,
  reportProgress,
}) => {
  const productKey = getCoordinator(claim.exactInputs).productKey;
  if (typeof productKey !== "string" || !productKey) {
    throw new PipelineStageExecutionError("The product stage has no product key.", {
      code: "product-key-missing",
      retryable: false,
    });
  }
  const release = findUpstreamOutput(
    claim.exactInputs,
    (output) => typeof output.releaseSetId === "string",
  );
  const parentKey = aggregateParentByProduct[productKey];
  const parent = parentKey
    ? findUpstreamOutput(
        claim.exactInputs,
        (output) => output.productKey === parentKey && typeof output.publicationId === "string",
      )
    : null;
  const targetPins = asRecord(
    claim.exactInputs.tier1ExpectedCurrentPublicationIds,
  );
  if (!(productKey in targetPins)) {
    throw new PipelineStageExecutionError(
      `The ${productKey} build has no exact stable-target snapshot.`,
      { code: "product-target-snapshot-missing", retryable: false },
    );
  }
  const expectedCurrentPublicationId = targetPins[productKey];
  if (
    expectedCurrentPublicationId !== null &&
    typeof expectedCurrentPublicationId !== "string"
  ) {
    throw new PipelineStageExecutionError(
      `The ${productKey} stable-target snapshot is invalid.`,
      { code: "product-target-snapshot-invalid", retryable: false },
    );
  }
  await reportProgress(0, 1);
  const candidate = await buildPipelineProduct({
    definitionKey: productKey,
    releaseSetId: claim.stageKind === "merge"
      ? requiredText(
          release?.releaseSetId,
          "The Tier 1 merge has no finalized release set.",
          "release-set-missing",
        )
      : null,
    parentPublicationId: claim.stageKind === "aggregate"
      ? requiredText(
          parent?.publicationId,
          `The ${productKey} build has no exact parent publication.`,
          "parent-publication-missing",
        )
      : null,
    actorOwnerId: claim.actorOwnerId,
    actorEmail: claim.actorEmail,
    expectedCurrentPublicationId,
  });
  if (!candidate || candidate.status === "failed") {
    throw new PipelineStageExecutionError(
      "The Tier 1 product build failed.",
      { code: "product-build-failed", retryable: true },
    );
  }
  await reportProgress(1, 1);
  return {
    outcome: "succeeded",
    rowCount: candidate.outputRowCount,
    output: {
      productKey,
      pipelineRunId: candidate.id,
      publicationTargetKey: candidate.publicationTargetKey,
      expectedCurrentPublicationId: candidate.expectedCurrentPublicationId,
      candidateStatus: candidate.status,
      outputChecksum: candidate.outputChecksum,
    },
    findingSummary: {
      warningCount: candidate.warningCount,
      errorCount: candidate.errorCount,
    },
  };
};

export const runTier1ProductPublicationStage: PipelineStageHandler = async ({
  claim,
  reportProgress,
}) => {
  const productKey = getCoordinator(claim.exactInputs).productKey;
  if (typeof productKey !== "string" || !productKey) {
    throw new PipelineStageExecutionError("The product publication has no product key.", {
      code: "product-key-missing",
      retryable: false,
    });
  }
  const candidate = getUpstreamOutput(claim.exactInputs, productKey);
  const pipelineRunId = requiredText(
    candidate.pipelineRunId,
    "The product publication cannot resolve its candidate.",
    "product-candidate-missing",
  );
  const expectedCurrentPublicationId = candidate.expectedCurrentPublicationId;
  if (
    expectedCurrentPublicationId !== null &&
    typeof expectedCurrentPublicationId !== "string"
  ) {
    throw new PipelineStageExecutionError(
      "The product publication has no exact publication-target snapshot.",
      { code: "product-target-snapshot-missing", retryable: false },
    );
  }
  const reason = reviewReason(claim.exactInputs, `${productKey}-review`);
  await reportProgress(0, 1);
  const published = await publishPipelineRun({
    runId: pipelineRunId,
    reason,
    acknowledgeWarnings: warningsAcknowledged(
      claim.exactInputs,
      `${productKey}-review`,
    ),
    expectedCurrentPublicationId,
    actorOwnerId: claim.actorOwnerId,
    actorEmail: claim.actorEmail,
  });
  if (!published?.publicationId) {
    throw new PipelineStageExecutionError("The product publication did not return its audit anchor.", {
      code: "product-publication-missing",
      retryable: true,
    });
  }
  await reportProgress(1, 1);
  return {
    outcome: "succeeded",
    rowCount: published.outputRowCount,
    output: {
      productKey,
      pipelineRunId,
      publicationId: published.publicationId,
      datasetId: published.datasetId,
      outputChecksum: published.outputChecksum,
    },
  };
};

export async function rejectPipelineReviewCandidate(input: {
  run: PipelineRunDetail;
  stageKey: string;
  reason: string;
  identity: CurrentIdentity;
}) {
  const reviewStage = input.run.stages.find(
    (stage) => stage.key === input.stageKey && stage.kind === "review",
  );
  if (!reviewStage) {
    throw new PipelineStageExecutionError(
      "The requested review gate could not be resolved.",
      { code: "review-stage-missing", retryable: false },
    );
  }
  const candidateStage = [...input.run.stages]
    .filter((stage) => stage.index < reviewStage.index)
    .at(-1);
  const output = asRecord(candidateStage?.output);
  const formingRunId = typeof output.formingRunId === "string"
    ? output.formingRunId
    : null;
  const identityRunId = typeof output.identityRunId === "string"
    ? output.identityRunId
    : null;
  const productRunId = [
    output.pipelineRunId,
    output.tier2RunId,
    output.aggregate2RunId,
  ].find((value): value is string => typeof value === "string");
  const releaseSetId = typeof output.releaseSetId === "string"
    ? output.releaseSetId
    : null;

  if (releaseSetId && candidateStage?.effectKey === "release-set-build") {
    await rejectPipelineReleaseSetCandidate({
      releaseSetId,
      reason: input.reason,
      actorOwnerId: input.identity.ownerId,
      actorEmail: input.identity.email,
    });
    return;
  }
  if (formingRunId) {
    if (candidateStage?.effectKey === "tier2-forming") {
      await rejectTier2PartnerFormingCandidate({
        formingRunId,
        reason: input.reason,
        actorOwnerId: input.identity.ownerId,
      });
      return;
    }
    await rejectImbFormingRun({
      formingRunId,
      connectionId: requiredText(
        output.connectionId,
        "The forming candidate has no exact connection.",
        "forming-connection-missing",
      ),
      sourceRunId: requiredText(
        output.apiConnectionRunId,
        "The forming candidate has no exact ingestion run.",
        "forming-source-run-missing",
      ),
      identity: input.identity,
      decision: { reason: input.reason, warningsAcknowledged: false },
    });
    return;
  }
  if (identityRunId) {
    if (candidateStage?.effectKey === "tier2-identity-reconcile") {
      await rejectTier2PartnerIdentityCandidate({
        identityRunId,
        reason: input.reason,
        actorOwnerId: input.identity.ownerId,
        actorEmail: input.identity.email,
      });
    } else {
      await rejectAxIdentityCandidate({
        runId: identityRunId,
        reason: input.reason,
        identity: input.identity,
      });
    }
    return;
  }
  if (productRunId) {
    if (
      candidateStage?.effectKey === "tier2-release-set-build" ||
      candidateStage?.effectKey === "tier2-merge" ||
      candidateStage?.effectKey === "aggregate2-build"
    ) {
      await rejectTier2ProductRun({
        runId: productRunId,
        reason: input.reason,
        actorOwnerId: input.identity.ownerId,
        actorEmail: input.identity.email,
      });
    } else {
      await rejectPipelineRun({
        runId: productRunId,
        reason: input.reason,
        actorOwnerId: input.identity.ownerId,
      });
    }
  }
}

export const registeredPipelineStageHandlers: PipelineStageHandlers = Object.freeze({
  "source-ingestion": runSourceIngestionStage,
  "source-forming": runSourceFormingStage,
  "source-publish": runSourcePublicationStage,
  "identity-reconcile": runIdentityReconciliationStage,
  "identity-publish": runIdentityPublicationStage,
  "release-set-build": runTier1ReleaseSetStage,
  "release-set-finalize": runTier1ReleaseFinalizationStage,
  "tier1-merge": runTier1ProductBuildStage,
  "aggregate1-build": runTier1ProductBuildStage,
  "pipeline-product-publish": runTier1ProductPublicationStage,
  "tier2-forming": runTier2FormingStage,
  "tier2-forming-publish": runTier2FormingPublicationStage,
  "tier2-identity-reconcile": runTier2IdentityStage,
  "tier2-identity-publish": runTier2IdentityPublicationStage,
  "tier2-release-set-build": runTier2ReleaseStage,
  "tier2-merge": runTier2MergeStage,
  "aggregate2-build": runAggregate2Stage,
  "tier2-product-publish": runTier2PublishStage,
});
