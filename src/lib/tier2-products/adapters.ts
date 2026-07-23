import type {
  PipelineJsonObject,
  PipelineStageHandlerContext,
  PipelineStageResult,
} from "@/lib/pipeline-operations/types";

import { Tier2ProductError } from "./errors";
import {
  buildTier2PartnerFormingCandidate,
  buildTier2PartnerIdentityCandidate,
  publishTier2PartnerFormingCandidate,
  publishTier2PartnerIdentityCandidate,
} from "./partner-lifecycle";
import {
  createTier2ProductRelease,
  finalizeTier2ProductReleaseCandidate,
  getTier2ProductRun,
  publishTier2ProductRun,
  type Tier2ReleaseMemberSelection,
} from "./operations";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function string(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function upstreamOutputs(input: PipelineJsonObject) {
  return Object.values(record(input.upstreamOutputs)).map(record);
}

function findUpstream(input: PipelineJsonObject, key: string) {
  return upstreamOutputs(input).find((output) => string(output[key])) ?? null;
}

function upstreamAt(input: PipelineJsonObject, stageKey: string) {
  return record(record(input.upstreamOutputs)[stageKey]);
}

function memberSelections(value: unknown): Tier2ReleaseMemberSelection[] {
  if (!Array.isArray(value)) {
    throw new Tier2ProductError("Exact release publication members are required.", 400, "release-members-missing");
  }
  return value.map((entry) => {
    const item = record(entry);
    const inputKey = string(item.inputKey);
    const publicationId = string(item.publicationId);
    const expectedChecksum = string(item.expectedChecksum);
    if (!inputKey || !publicationId || !expectedChecksum) {
      throw new Tier2ProductError("A release member is incomplete.", 400, "release-member-invalid");
    }
    return { inputKey, publicationId, expectedChecksum };
  });
}

function exactValue(input: PipelineJsonObject, key: string) {
  return string(input[key]) ?? string(record(input.coordinator)[key]);
}

function releaseReason(input: PipelineJsonObject, fallback: string) {
  const review = findUpstream(input, "reason");
  return exactValue(input, "reason") ?? string(review?.reason) ?? fallback;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function expectedTier2PublicationTarget(
  input: PipelineJsonObject,
  productKind: "tier2" | "aggregate2",
) {
  const targetPins = record(input.tier2ExpectedCurrentPublicationIds);
  if (!(productKind in targetPins)) {
    throw new Tier2ProductError(
      `The ${productKind === "tier2" ? "Tier 2" : "Aggregate 2"} build has no launch-pinned stable target.`,
      409,
      "publication-target-pin-missing",
    );
  }
  const expectedCurrentPublicationId = targetPins[productKind];
  if (
    expectedCurrentPublicationId !== null &&
    (
      typeof expectedCurrentPublicationId !== "string" ||
      !UUID_PATTERN.test(expectedCurrentPublicationId)
    )
  ) {
    throw new Tier2ProductError(
      `The ${productKind === "tier2" ? "Tier 2" : "Aggregate 2"} build has an invalid stable-target pin.`,
      409,
      "publication-target-pin-invalid",
    );
  }
  return expectedCurrentPublicationId;
}

export async function runTier2FormingStage(
  context: PipelineStageHandlerContext,
): Promise<PipelineStageResult> {
  const profileId = exactValue(context.claim.exactInputs, "profileId");
  const ingestion = findUpstream(context.claim.exactInputs, "apiConnectionRunId");
  const sourceRunId = exactValue(context.claim.exactInputs, "sourceRunId") ??
    string(ingestion?.apiConnectionRunId);
  if (!profileId || !sourceRunId) {
    throw new Tier2ProductError(
      "Tier 2 forming requires an exact partner profile and ingestion run.",
      400,
      "forming-inputs-missing",
    );
  }
  const profileBindings = record(context.claim.exactInputs.tier2ProfileBindings);
  const profileBinding = Object.values(profileBindings)
    .map(record)
    .find((binding) => string(binding.id) === profileId);
  const contractVersionIds = record(
    context.claim.exactInputs.tier2ContractVersionIds,
  );
  const resourceSetId = exactValue(context.claim.exactInputs, "resourceSetId");
  const registryRevision = record(context.claim.exactInputs.registryRevision);
  const baseRegistryRevisionId = string(registryRevision.registryRevisionId) ??
    exactValue(context.claim.exactInputs, "registryRevisionId");
  const baseRegistryRevisionChecksum = string(registryRevision.checksum);
  if (
    !profileBinding || !resourceSetId || !baseRegistryRevisionId ||
    !baseRegistryRevisionChecksum
  ) {
    throw new Tier2ProductError(
      "Tier 2 forming requires exact profile, resource, and AX registry bindings.",
      400,
      "forming-bindings-missing",
    );
  }
  await context.reportProgress(0, 2);
  const candidate = await buildTier2PartnerFormingCandidate({
    profileId,
    sourceRunId,
    actorOwnerId: context.claim.actorOwnerId,
    actorEmail: context.claim.actorEmail,
    resourceSetId,
    baseRegistryRevisionId,
    baseRegistryRevisionChecksum,
    contractVersionIds: Object.fromEntries(
      Object.entries(contractVersionIds).flatMap(([key, value]) => {
        const versionId = string(value);
        return versionId ? [[key, versionId]] : [];
      }),
    ),
    expectedProfileContractChecksum:
      string(profileBinding.contractChecksum) ?? undefined,
    expectedProfileUpdatedAt: string(profileBinding.updatedAt) ?? undefined,
  });
  if (!candidate) throw new Tier2ProductError("Tier 2 forming did not create a candidate.", 500, "forming-build-missing");
  await context.reportProgress(1, 2);
  await context.reportProgress(2, 2);
  return {
    outcome: "succeeded",
    rowCount: candidate.outputRowCount,
    output: {
      profileId,
      formingRunId: candidate.id,
      sourcePublicationId: candidate.sourcePublicationId,
      candidateStatus: candidate.status,
      outputChecksum: candidate.outputChecksum,
      resourceSetId: candidate.resourceSetId,
      expectedCurrentPublicationId: candidate.expectedCurrentPublicationId,
      identityInputSnapshot: candidate.identityInputSnapshot,
    },
    findingSummary: {
      warningCount: candidate.warningCount,
      errorCount: candidate.errorCount,
    },
  };
}

export async function runTier2FormingPublicationStage(
  context: PipelineStageHandlerContext,
): Promise<PipelineStageResult> {
  const forming = findUpstream(context.claim.exactInputs, "formingRunId");
  const formingRunId = exactValue(context.claim.exactInputs, "formingRunId") ??
    string(forming?.formingRunId);
  const review = findUpstream(context.claim.exactInputs, "approved");
  const acknowledged = context.claim.exactInputs.acknowledgeWarnings === true ||
    review?.acknowledgeWarnings === true;
  const approved = context.claim.exactInputs.approved === true || review?.approved === true;
  if (!formingRunId || !approved) {
    throw new Tier2ProductError(
      "An approved Tier 2 forming review is required before publication.",
      409,
      "forming-review-required",
    );
  }
  const published = await publishTier2PartnerFormingCandidate({
    formingRunId,
    reason: releaseReason(
      context.claim.exactInputs,
      `Pipeline flow ${context.claim.flowRunId} approved forming publication`,
    ),
    acknowledgeWarnings: acknowledged,
    actorOwnerId: context.claim.actorOwnerId,
    actorEmail: context.claim.actorEmail,
  });
  return {
    outcome: "succeeded",
    rowCount: published.formingRun?.outputRowCount ?? null,
    output: {
      formingRunId,
      sourcePublicationId: published.sourcePublicationId,
    },
  };
}

export async function runTier2IdentityStage(
  context: PipelineStageHandlerContext,
): Promise<PipelineStageResult> {
  const formingCandidate = upstreamAt(
    context.claim.exactInputs,
    "tier2-partner-form",
  );
  const formingPublication = upstreamAt(
    context.claim.exactInputs,
    "tier2-partner-publish",
  );
  const formingRunId = exactValue(context.claim.exactInputs, "formingRunId") ??
    string(formingPublication.formingRunId) ??
    string(formingCandidate.formingRunId);
  const sourcePublicationId = exactValue(context.claim.exactInputs, "sourcePublicationId") ??
    string(formingPublication.sourcePublicationId);
  if (!formingRunId || !sourcePublicationId) {
    throw new Tier2ProductError(
      "Tier 2 identity requires the exact immutable forming publication.",
      409,
      "forming-publication-required",
    );
  }
  await context.reportProgress(0, 1);
  const candidate = await buildTier2PartnerIdentityCandidate({
    formingRunId,
    sourcePublicationId,
    actorOwnerId: context.claim.actorOwnerId,
    actorEmail: context.claim.actorEmail,
  });
  if (!candidate) throw new Tier2ProductError("Identity reconciliation did not create a candidate.", 500, "identity-build-missing");
  await context.reportProgress(1, 1);
  return {
    outcome: "succeeded",
    rowCount: candidate.outputRowCount,
    output: {
      formingRunId,
      sourcePublicationId,
      identityRunId: candidate.id,
      candidateStatus: candidate.status,
      outputChecksum: candidate.outputChecksum,
    },
    findingSummary: {
      warningCount: candidate.warningCount,
      errorCount: candidate.errorCount,
      conflictCount: candidate.conflictCount,
      unassignableCount: candidate.unassignableCount,
    },
  };
}

export async function runTier2IdentityPublicationStage(
  context: PipelineStageHandlerContext,
): Promise<PipelineStageResult> {
  const identityCandidate = findUpstream(context.claim.exactInputs, "identityRunId");
  const identityRunId = exactValue(context.claim.exactInputs, "identityRunId") ??
    string(identityCandidate?.identityRunId);
  const review = findUpstream(context.claim.exactInputs, "approved");
  const approved = context.claim.exactInputs.approved === true || review?.approved === true;
  if (!identityRunId || !approved) {
    throw new Tier2ProductError(
      "An approved Tier 2 identity review is required before publication.",
      409,
      "identity-review-required",
    );
  }
  const published = await publishTier2PartnerIdentityCandidate({
    identityRunId,
    reason: releaseReason(
      context.claim.exactInputs,
      `Pipeline flow ${context.claim.flowRunId} approved identity publication`,
    ),
    actorOwnerId: context.claim.actorOwnerId,
    actorEmail: context.claim.actorEmail,
  });
  return {
    outcome: "succeeded",
    output: {
      identityRunId,
      identityPublicationId: published.publicationId,
      registryRevisionId: published.revisionId,
      datasetId: published.datasetId,
    },
  };
}

export async function runTier2ReleaseStage(
  context: PipelineStageHandlerContext,
): Promise<PipelineStageResult> {
  const resourceSetId = exactValue(context.claim.exactInputs, "resourceSetId");
  const registryRevisionId = exactValue(context.claim.exactInputs, "registryRevisionId");
  if (!resourceSetId || !registryRevisionId) {
    throw new Tier2ProductError("Tier 2 release requires exact resource and registry revisions.", 400, "release-bindings-missing");
  }
  const members = memberSelections(
    context.claim.exactInputs.tier2Members ?? context.claim.exactInputs.members,
  );
  const expectedCurrentPublicationId = expectedTier2PublicationTarget(
    context.claim.exactInputs,
    "tier2",
  );
  await context.reportProgress(0, 1);
  const run = await createTier2ProductRelease({
    productKind: "tier2",
    resourceSetId,
    registryRevisionId,
    expectedCurrentPublicationId,
    members,
    actorOwnerId: context.claim.actorOwnerId,
    actorEmail: context.claim.actorEmail,
    reason: releaseReason(context.claim.exactInputs, `Pipeline flow ${context.claim.flowRunId} Tier 2 release`),
  });
  if (!run) throw new Tier2ProductError("Tier 2 release did not create a candidate.", 500, "tier2-run-missing");
  await context.reportProgress(1, 1);
  return {
    outcome: "succeeded",
    rowCount: run.outputRowCount,
    output: {
      tier2RunId: run.id,
      releaseSetId: run.releaseSetId,
      candidateStatus: run.status,
      outputChecksum: run.outputChecksum,
    },
    findingSummary: { warningCount: run.warningCount, errorCount: run.errorCount },
  };
}

export async function runTier2MergeStage(
  context: PipelineStageHandlerContext,
): Promise<PipelineStageResult> {
  const release = findUpstream(context.claim.exactInputs, "tier2RunId");
  const review = upstreamAt(
    context.claim.exactInputs,
    "tier2-release-review",
  );
  const runId = exactValue(context.claim.exactInputs, "tier2RunId") ??
    string(release?.tier2RunId);
  const reason = string(review.reason);
  if (!runId || review.approved !== true || !reason) {
    throw new Tier2ProductError(
      "An approved Tier 2 release review with a reason is required before finalization.",
      409,
      "tier2-release-review-required",
    );
  }
  const finalized = await finalizeTier2ProductReleaseCandidate({
    runId,
    actorOwnerId: context.claim.actorOwnerId,
    actorEmail: context.claim.actorEmail,
    reason,
  });
  const run = await getTier2ProductRun(runId);
  if (!run || run.productKind !== "tier2") {
    throw new Tier2ProductError("The selected run is not a Tier 2 Combined Release.", 409, "tier2-run-incompatible");
  }
  await context.reportProgress(1, 1);
  return {
    outcome: "succeeded",
    rowCount: run.outputRowCount,
    output: {
      tier2RunId: run.id,
      releaseSetId: run.releaseSetId,
      releaseStatus: finalized.status,
      releaseChecksum: finalized.canonicalChecksum,
      candidateStatus: run.status,
      outputChecksum: run.outputChecksum,
    },
    findingSummary: { warningCount: run.warningCount, errorCount: run.errorCount },
  };
}

export async function runAggregate2Stage(
  context: PipelineStageHandlerContext,
): Promise<PipelineStageResult> {
  const resourceSetId = exactValue(context.claim.exactInputs, "resourceSetId");
  const registryRevisionId = exactValue(context.claim.exactInputs, "registryRevisionId");
  if (!resourceSetId || !registryRevisionId) {
    throw new Tier2ProductError("Aggregate 2 requires exact resource and registry revisions.", 400, "release-bindings-missing");
  }
  const pinnedMembers = memberSelections(context.claim.exactInputs.aggregate2Members);
  const tier2Publication = upstreamAt(
    context.claim.exactInputs,
    "tier2-merge-publish",
  );
  const tier2Candidate = upstreamAt(context.claim.exactInputs, "tier2-merge");
  const tier2PublicationId = string(tier2Publication.publicationId);
  const tier2Checksum = string(tier2Candidate.outputChecksum);
  if (!tier2PublicationId || !tier2Checksum) {
    throw new Tier2ProductError(
      "Aggregate 2 requires the freshly published Tier 2 Combined Release from this flow.",
      409,
      "fresh-tier2-publication-required",
    );
  }
  const members = [
    {
      inputKey: "tier2",
      publicationId: tier2PublicationId,
      expectedChecksum: tier2Checksum,
    },
    ...pinnedMembers.filter((member) => member.inputKey !== "tier2"),
  ];
  const expectedCurrentPublicationId = expectedTier2PublicationTarget(
    context.claim.exactInputs,
    "aggregate2",
  );
  await context.reportProgress(0, 1);
  const run = await createTier2ProductRelease({
    productKind: "aggregate2",
    resourceSetId,
    registryRevisionId,
    expectedCurrentPublicationId,
    members,
    actorOwnerId: context.claim.actorOwnerId,
    actorEmail: context.claim.actorEmail,
    reason: releaseReason(context.claim.exactInputs, `Pipeline flow ${context.claim.flowRunId} Aggregate 2 Combined Release`),
  });
  if (!run) throw new Tier2ProductError("Aggregate 2 did not create a candidate.", 500, "aggregate2-run-missing");
  await context.reportProgress(1, 1);
  return {
    outcome: "succeeded",
    rowCount: run.outputRowCount,
    output: {
      aggregate2RunId: run.id,
      releaseSetId: run.releaseSetId,
      candidateStatus: run.status,
      outputChecksum: run.outputChecksum,
    },
    findingSummary: { warningCount: run.warningCount, errorCount: run.errorCount },
  };
}

export async function runTier2PublishStage(
  context: PipelineStageHandlerContext,
): Promise<PipelineStageResult> {
  const aggregate = context.claim.stageKey === "aggregate2-publish";
  const productKind = aggregate ? "aggregate2" : "tier2";
  const buildStageKey = aggregate ? "aggregate2" : "tier2-merge";
  const reviewStageKey = aggregate ? "aggregate2-review" : "tier2-merge-review";
  const built = upstreamAt(context.claim.exactInputs, buildStageKey);
  const reviewed = upstreamAt(context.claim.exactInputs, reviewStageKey);
  const runId = exactValue(context.claim.exactInputs, "productRunId") ??
    exactValue(
      context.claim.exactInputs,
      aggregate ? "aggregate2RunId" : "tier2RunId",
    ) ??
    string(built[aggregate ? "aggregate2RunId" : "tier2RunId"]);
  const approved = context.claim.exactInputs.approved === true ||
    reviewed.approved === true;
  if (!runId || !approved) {
    throw new Tier2ProductError(
      "The exact product candidate and its approved review are required before publication.",
      409,
      "product-review-required",
    );
  }
  const result = await publishTier2ProductRun({
    runId,
    acknowledgeWarnings: context.claim.exactInputs.acknowledgeWarnings === true ||
      reviewed.acknowledgeWarnings === true,
    actorOwnerId: context.claim.actorOwnerId,
    actorEmail: context.claim.actorEmail,
    reason: exactValue(context.claim.exactInputs, "reason") ??
      string(reviewed.reason) ??
      `Pipeline flow ${context.claim.flowRunId} approved ${productKind} publication`,
  });
  return {
    outcome: "succeeded",
    rowCount: result.run?.outputRowCount ?? null,
    output: {
      productRunId: runId,
      productKind,
      publicationId: result.publicationId,
      versionNumber: result.versionNumber,
    },
  };
}
