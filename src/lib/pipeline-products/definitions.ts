import {
  buildBaselineUupg,
  buildHotspots,
  buildPgacAggregate1,
  buildSelfEngaged,
  buildSouthAsia,
  buildWatchlist,
  checksumProductValue,
  mergeTier1ByCanonicalPgic,
  mergeTier1SpecificPeopleGroups,
  getTier1ProductSemanticContract,
  type PipelineProductResult,
  type Tier1ProductSemanticContractKey,
  type Tier1ProductInputRow,
} from "@/lib/tier1-products";

import type { PipelineDefinition, PipelineDefinitionBuildInput } from "./types";

const TIER1_INPUTS = ["ax", "etno", "imb", "jp", "wcd"] as const;

function flattenTier1Inputs(input: PipelineDefinitionBuildInput): Tier1ProductInputRow[] {
  return input.inputs.flatMap((publication) =>
    publication.rows.map((row, index) => ({
      sourceKey: publication.inputKey,
      sourceLabel: publication.inputKey.toUpperCase(),
      stableRowKey:
        row.Dataset_Row_Key?.trim()
        || row.dataset_row_key?.trim()
        || `${publication.publicationId}:${index}`,
      row,
    })),
  );
}

function requireSingleParent(input: PipelineDefinitionBuildInput) {
  if (input.inputs.length !== 1) {
    throw new Error("This pipeline product requires exactly one parent publication.");
  }
  return input.inputs[0].rows;
}

export function checksumPipelineProductDefinition(input: Pick<
  PipelineDefinition,
  | "key"
  | "stage"
  | "version"
  | "requiredInputKeys"
  | "outputClassification"
  | "publicationTargetKey"
  | "isWorkspaceVisible"
  | "semanticContract"
>) {
  return checksumProductValue({
    key: input.key,
    stage: input.stage,
    version: input.version,
    requiredInputKeys: input.requiredInputKeys,
    outputClassification: input.outputClassification,
    publicationTargetKey: input.publicationTargetKey,
    isWorkspaceVisible: input.isWorkspaceVisible,
    semanticContract: input.semanticContract,
  });
}

function define(
  input: Omit<PipelineDefinition, "checksum" | "semanticContract"> & {
    key: Tier1ProductSemanticContractKey;
  },
): PipelineDefinition {
  const semanticContract = getTier1ProductSemanticContract(input.key);
  return Object.freeze({
    ...input,
    semanticContract,
    checksum: checksumPipelineProductDefinition({
      key: input.key,
      stage: input.stage,
      version: input.version,
      requiredInputKeys: input.requiredInputKeys,
      outputClassification: input.outputClassification,
      publicationTargetKey: input.publicationTargetKey,
      isWorkspaceVisible: input.isWorkspaceVisible,
      semanticContract,
    }),
  });
}

const definitions = [
  define({
    key: "tier1-pgic-merge",
    stage: "tier1-merge",
    displayName: "Tier 1 canonical PGIC merge",
    version: "v1",
    requiredInputKeys: TIER1_INPUTS,
    outputClassification: "PGIC",
    publicationTargetKey: "tier1-pgic",
    isWorkspaceVisible: true,
    build: (input) => mergeTier1ByCanonicalPgic({ rows: flattenTier1Inputs(input), priorities: input.priorities }),
  }),
  define({
    key: "tier1-specific-pg-merge",
    stage: "tier1-merge",
    displayName: "Tier 1 specific people-group merge",
    version: "v1",
    requiredInputKeys: TIER1_INPUTS,
    outputClassification: "PGIC",
    publicationTargetKey: "tier1-specific-pg",
    isWorkspaceVisible: true,
    build: (input) => mergeTier1SpecificPeopleGroups({ rows: flattenTier1Inputs(input), priorities: input.priorities }),
  }),
  define({
    key: "aggregate1-pgac",
    stage: "aggregate1",
    displayName: "PGAC Aggregate 1",
    version: "v1",
    requiredInputKeys: ["tier1-specific-pg"],
    outputClassification: "PGAC",
    publicationTargetKey: "aggregate1-pgac",
    isWorkspaceVisible: true,
    build: (input) => buildPgacAggregate1({ rows: requireSingleParent(input), priorities: input.priorities }),
  }),
  define({
    key: "aggregate1-self-engaged",
    stage: "aggregate1",
    displayName: "PGAC Self-Engaged",
    version: "v1",
    requiredInputKeys: ["aggregate1-pgac"],
    outputClassification: "PGAC",
    publicationTargetKey: "aggregate1-self-engaged",
    isWorkspaceVisible: true,
    build: (input) => buildSelfEngaged(requireSingleParent(input)),
  }),
  define({
    key: "aggregate1-watchlist",
    stage: "aggregate1",
    displayName: "Watchlist",
    version: "v1",
    requiredInputKeys: ["aggregate1-pgac"],
    outputClassification: "PGAC",
    publicationTargetKey: "aggregate1-watchlist",
    isWorkspaceVisible: true,
    build: (input) => buildWatchlist(requireSingleParent(input)),
  }),
  define({
    key: "aggregate1-baseline-uupg",
    stage: "aggregate1",
    displayName: "Baseline UUPG",
    version: "v1",
    requiredInputKeys: ["aggregate1-watchlist"],
    outputClassification: "PGAC",
    publicationTargetKey: "aggregate1-baseline-uupg",
    isWorkspaceVisible: true,
    build: (input) => buildBaselineUupg(requireSingleParent(input)),
  }),
  define({
    key: "aggregate1-hotspots",
    stage: "aggregate1",
    displayName: "Baseline UUPG Hotspots",
    version: "v1",
    requiredInputKeys: ["aggregate1-baseline-uupg"],
    outputClassification: "PGAC",
    publicationTargetKey: "aggregate1-hotspots",
    isWorkspaceVisible: true,
    build: (input) => buildHotspots(requireSingleParent(input)),
  }),
  define({
    key: "aggregate1-south-asia",
    stage: "aggregate1",
    displayName: "South Asia",
    version: "v1",
    requiredInputKeys: ["aggregate1-pgac"],
    outputClassification: "PGAC",
    publicationTargetKey: "aggregate1-south-asia",
    isWorkspaceVisible: true,
    build: (input) => buildSouthAsia(requireSingleParent(input)),
  }),
] as const satisfies readonly PipelineDefinition[];

const definitionMap = new Map(definitions.map((definition) => [definition.key, definition]));

export function listPipelineDefinitions() {
  return [...definitions];
}

export function getPipelineDefinition(definitionKey: string) {
  const definition = definitionMap.get(definitionKey);
  if (!definition) throw new Error(`Unknown pipeline definition: ${definitionKey}.`);
  return definition;
}

export function runPipelineDefinition(
  definitionKey: string,
  input: PipelineDefinitionBuildInput,
): PipelineProductResult {
  return getPipelineDefinition(definitionKey).build(input);
}
