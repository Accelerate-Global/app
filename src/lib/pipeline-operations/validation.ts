import { createHash } from "node:crypto";

import { datasetFormingEngineRegistry } from "@/lib/dataset-forming";

import type {
  PipelineFlowDefinition,
  PipelineJsonObject,
} from "./types";
import { PipelineOperationError } from "./errors";
import { parseExactReferenceResourceSnapshot } from "./resource-pins";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CURRENT_SENTINELS = new Set(["latest", "current", "active", "newest"]);
const CHECKSUM_PATTERN = /^[0-9a-f]{64}$/i;
const STRUCTURED_BACKFILL_FIELDS = new Set([
  "connectionIds",
  "sourceRunIds",
  "sourceChecksums",
  "sourceProfileBindings",
  "sourceExecutionBindings",
  "referenceVersionIds",
  "referenceVersionBindings",
  "publicationIds",
  "formingPublicationIds",
  "identityPublicationIds",
  "productPublicationIds",
  "registryRevision",
  "tier1RuleBinding",
  "tier2ProfileIds",
  "tier2ProfileBindings",
  "tier2ContractVersionIds",
  "tier2ContractBindings",
  "tier2Members",
  "aggregate2Members",
  "tier1ExpectedCurrentPublicationIds",
  "tier2ExpectedCurrentPublicationIds",
]);
const NULLABLE_ID_MAP_FIELDS = new Set([
  "formingPublicationIds",
  "tier1ExpectedCurrentPublicationIds",
  "tier2ExpectedCurrentPublicationIds",
]);

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function exactSourceValue(
  input: PipelineJsonObject,
  singularKey: "sourceRunId" | "sourceChecksum",
  mapKey: "sourceRunIds" | "sourceChecksums",
  sourceProfileKey: string,
  sourceCount: number,
) {
  if (sourceCount === 1 && typeof input[singularKey] === "string") {
    return input[singularKey];
  }
  return record(input[mapKey])[sourceProfileKey];
}

function requireBackfillValue(
  value: unknown,
  message: string,
  code: string,
) {
  if (value !== undefined && value !== null) return value;
  throw new PipelineOperationError(message, 400, code);
}

export function assertCompleteBackfillInputs(
  definition: PipelineFlowDefinition,
  input: PipelineJsonObject,
) {
  const sourceProfileKeys = [
    ...new Set(
      definition.stages.flatMap((stage) =>
        stage.effectKey === "source-ingestion" && stage.sourceProfileKey
          ? [stage.sourceProfileKey]
          : []
      ),
    ),
  ];
  const connectionIds = record(input.connectionIds);
  const sourceProfiles = record(input.sourceProfileBindings);
  const sourceExecutions = record(input.sourceExecutionBindings);

  for (const sourceProfileKey of sourceProfileKeys) {
    requireBackfillValue(
      exactSourceValue(
        input,
        "sourceRunId",
        "sourceRunIds",
        sourceProfileKey,
        sourceProfileKeys.length,
      ),
      `Backfill ${definition.key} requires the exact archived source run for ${sourceProfileKey}.`,
      "backfill-source-run-required",
    );
    requireBackfillValue(
      exactSourceValue(
        input,
        "sourceChecksum",
        "sourceChecksums",
        sourceProfileKey,
        sourceProfileKeys.length,
      ),
      `Backfill ${definition.key} requires the archived source checksum for ${sourceProfileKey}.`,
      "backfill-source-checksum-required",
    );

    if (sourceProfileKey === "tier2-partner") {
      const profileId = requireBackfillValue(
        input.profileId,
        "Tier 2 partner backfills require an exact profile ID.",
        "backfill-tier2-profile-required",
      );
      const profileBinding = Object.values(record(input.tier2ProfileBindings))
        .map(record)
        .find((binding) => binding.id === profileId);
      requireBackfillValue(
        profileBinding?.connectionId,
        "Tier 2 partner backfills require the exact profile connection binding.",
        "backfill-source-binding-required",
      );
      requireBackfillValue(
        sourceExecutions[`tier2-partner:${String(profileId)}`] ??
          sourceExecutions["tier2-partner"],
        "Tier 2 partner backfills require the exact source execution contract.",
        "backfill-source-execution-required",
      );
    } else {
      requireBackfillValue(
        connectionIds[sourceProfileKey],
        `Backfill ${definition.key} requires the exact connection for ${sourceProfileKey}.`,
        "backfill-source-connection-required",
      );
      requireBackfillValue(
        sourceProfiles[sourceProfileKey],
        `Backfill ${definition.key} requires the exact source-profile binding for ${sourceProfileKey}.`,
        "backfill-source-binding-required",
      );
      requireBackfillValue(
        sourceExecutions[sourceProfileKey],
        `Backfill ${definition.key} requires the exact source execution contract for ${sourceProfileKey}.`,
        "backfill-source-execution-required",
      );
    }
  }

  if (definition.stages.some((stage) => stage.kind === "forming")) {
    const resourceSnapshot = parseExactReferenceResourceSnapshot(input);
    const genericFormingProfiles = [
      ...new Set(definition.stages.flatMap((stage) =>
        stage.effectKey === "source-forming" && stage.sourceProfileKey
          ? [stage.sourceProfileKey]
          : []
      )),
    ];
    for (const sourceProfileKey of genericFormingProfiles) {
      const formingTargets = record(input.formingPublicationIds);
      if (!(sourceProfileKey in formingTargets)) {
        throw new PipelineOperationError(
          `Backfill ${definition.key} requires the prior forming publication pin for ${sourceProfileKey}.`,
          400,
          "backfill-forming-target-pin-required",
        );
      }
      const expectedCurrentPublicationId = formingTargets[sourceProfileKey];
      if (
        expectedCurrentPublicationId !== null &&
        (
          typeof expectedCurrentPublicationId !== "string" ||
          !UUID_PATTERN.test(expectedCurrentPublicationId)
        )
      ) {
        throw new PipelineOperationError(
          `Backfill ${definition.key} has an invalid forming publication pin for ${sourceProfileKey}.`,
          400,
          "backfill-forming-target-pin-invalid",
        );
      }
      const engine = datasetFormingEngineRegistry.requireBySourceProfile(
        sourceProfileKey,
      );
      for (const requirement of engine.resourceRequirements) {
        if (
          requirement.bindingType === "catalog" &&
          requirement.required &&
          !resourceSnapshot.referenceVersionBindings[requirement.key]
        ) {
          throw new PipelineOperationError(
            `Backfill ${definition.key} is missing the required ${requirement.key} reference binding.`,
            400,
            "backfill-resource-members-required",
          );
        }
      }
    }
  }

  if (definition.stages.some((stage) => stage.kind === "identity")) {
    requireBackfillValue(
      input.registryRevisionId,
      `Backfill ${definition.key} requires an exact AX registry revision.`,
      "backfill-registry-revision-required",
    );
    requireBackfillValue(
      record(input.registryRevision).checksum,
      `Backfill ${definition.key} requires the AX registry revision checksum.`,
      "backfill-registry-checksum-required",
    );
  }

  const tier1ProductKeys = [
    ...new Set(
      definition.stages.flatMap((stage) =>
        (stage.effectKey === "tier1-merge" ||
          stage.effectKey === "aggregate1-build") &&
        stage.productKey
          ? [stage.productKey]
          : []
      ),
    ),
  ];
  const tier1Targets = record(input.tier1ExpectedCurrentPublicationIds);
  for (const productKey of tier1ProductKeys) {
    if (!(productKey in tier1Targets)) {
      throw new PipelineOperationError(
        `Backfill ${definition.key} requires the stable-target pin for ${productKey}.`,
        400,
        "backfill-target-pin-required",
      );
    }
  }

  const tier2ProductKeys = [
    ...new Set(
      definition.stages.flatMap((stage) =>
        stage.effectKey === "tier2-release-set-build"
          ? ["tier2"]
          : stage.effectKey === "aggregate2-build"
            ? ["aggregate2"]
            : []
      ),
    ),
  ];
  const tier2Targets = record(input.tier2ExpectedCurrentPublicationIds);
  for (const productKey of tier2ProductKeys) {
    if (!(productKey in tier2Targets)) {
      throw new PipelineOperationError(
        `Backfill ${definition.key} requires the stable-target pin for ${productKey}.`,
        400,
        "backfill-target-pin-required",
      );
    }
    const expectedCurrentPublicationId = tier2Targets[productKey];
    if (
      expectedCurrentPublicationId !== null &&
      (
        typeof expectedCurrentPublicationId !== "string" ||
        !UUID_PATTERN.test(expectedCurrentPublicationId)
      )
    ) {
      throw new PipelineOperationError(
        `Backfill ${definition.key} has an invalid stable-target pin for ${productKey}.`,
        400,
        "backfill-target-pin-invalid",
      );
    }
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function fingerprintPipelineInputs(input: PipelineJsonObject) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(input)))
    .digest("hex");
}

export function assertExactBackfillInputs(input: PipelineJsonObject) {
  const entries = Object.entries(input);
  if (entries.length === 0) {
    throw new PipelineOperationError(
      "Backfills require at least one exact historical input identifier.",
      400,
      "backfill-input-required",
    );
  }

  let identifierCount = 0;

  const inspect = (
    value: unknown,
    key: string,
    structured: boolean,
    nullableIds = false,
  ) => {
    if (Array.isArray(value)) {
      if (key.endsWith("Ids")) {
        if (value.length === 0) {
          throw new PipelineOperationError(
            `Backfill input ${key} cannot be empty.`,
            400,
            "backfill-input-empty",
          );
        }
        for (const item of value) inspect(item, key.slice(0, -1), true);
        return;
      }
      for (const item of value) inspect(item, key, true);
      return;
    }
    if (value && typeof value === "object") {
      const identifierMap = key.endsWith("Ids");
      const checksumMap = key.endsWith("Checksums");
      for (const [childKey, childValue] of Object.entries(
        value as Record<string, unknown>,
      )) {
        inspect(
          childValue,
          identifierMap
            ? `${childKey}Id`
            : checksumMap
              ? `${childKey}Checksum`
              : childKey,
          true,
          nullableIds,
        );
      }
      return;
    }
    if (typeof value === "string" && CURRENT_SENTINELS.has(value.trim().toLowerCase())) {
      throw new PipelineOperationError(
        `Backfill input ${key} cannot resolve a current or latest value.`,
        400,
        "backfill-current-alias-forbidden",
      );
    }
    if (key.endsWith("Id")) {
      if (nullableIds && value === null) return;
      if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
        throw new PipelineOperationError(
          `Backfill input ${key} must contain UUID identifiers.`,
          400,
          "backfill-input-id-invalid",
        );
      }
      identifierCount += 1;
      return;
    }
    if (/checksum$/i.test(key)) {
      if (typeof value !== "string" || !CHECKSUM_PATTERN.test(value)) {
        throw new PipelineOperationError(
          `Backfill input ${key} must contain an exact SHA-256 checksum.`,
          400,
          "backfill-input-checksum-invalid",
        );
      }
      return;
    }
    if (!structured) {
      throw new PipelineOperationError(
        `Backfill input ${key} must be an explicit identifier field.`,
        400,
        "backfill-input-name-invalid",
      );
    }
  };

  for (const [key, value] of entries) {
    inspect(
      value,
      key,
      STRUCTURED_BACKFILL_FIELDS.has(key),
      NULLABLE_ID_MAP_FIELDS.has(key),
    );
  }
  if (identifierCount === 0) {
    throw new PipelineOperationError(
      "Backfills require at least one exact historical input identifier.",
      400,
      "backfill-input-required",
    );
  }
}

export function assertPipelineJsonObject(value: unknown): asserts value is PipelineJsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PipelineOperationError(
      "Pipeline inputs must be a JSON object.",
      400,
      "pipeline-inputs-invalid",
    );
  }
}
