import type { CsvColumn, DatasetClassification } from "@/lib/api-types";
import type { PipelineProductFinding, PipelineProductResult, Tier1PriorityRule } from "@/lib/tier1-products";

export const TIER1_RELEASE_INPUT_KEYS = ["ax", "etno", "imb", "jp", "wcd"] as const;

export type Tier1ReleaseInputKey = (typeof TIER1_RELEASE_INPUT_KEYS)[number];
export type PipelineStage = "tier1-merge" | "aggregate1";
export type PipelineRunStatus =
  | "building"
  | "valid"
  | "invalid"
  | "rejected"
  | "publishing"
  | "published"
  | "failed";

export type PipelinePublicationInput = Readonly<{
  inputKey: string;
  publicationId: string;
  outputChecksum: string;
  rowCount: number;
  registryRevisionId: string;
  rows: readonly Readonly<Record<string, string>>[];
}>;

export type PipelineDefinitionBuildInput = Readonly<{
  inputs: readonly PipelinePublicationInput[];
  priorities: readonly Tier1PriorityRule[];
}>;

export type PipelineDefinition = Readonly<{
  key: string;
  stage: PipelineStage;
  displayName: string;
  version: string;
  checksum: string;
  requiredInputKeys: readonly string[];
  outputClassification: DatasetClassification;
  publicationTargetKey: string;
  isWorkspaceVisible: boolean;
  semanticContract: Readonly<Record<string, unknown>>;
  build(input: PipelineDefinitionBuildInput): PipelineProductResult;
}>;

export type PipelineArtifactKind =
  | "rows-json"
  | "rows-csv"
  | "findings-json"
  | "lineage-json"
  | "comparison-json";

export type PipelineArtifactManifestEntry = Readonly<{
  kind: PipelineArtifactKind;
  storagePath: string;
  checksum: string;
  sizeBytes: number;
  schemaVersion: 1;
}>;

export type PipelineArtifactManifest = Readonly<{
  schemaVersion: 1;
  artifacts: readonly PipelineArtifactManifestEntry[];
}>;

export type PipelineRunSummary = Readonly<{
  id: string;
  definitionKey: string;
  definitionName: string;
  definitionVersion: string;
  definitionChecksum: string;
  releaseSetId: string | null;
  parentPublicationId: string | null;
  status: PipelineRunStatus;
  inputRowCount: number;
  outputRowCount: number | null;
  warningCount: number;
  errorCount: number;
  outputChecksum: string | null;
  publicationId: string | null;
  expectedCurrentPublicationId: string | null;
  publicationTargetKey: string;
  isOutOfDate: boolean;
  createdAt: string;
  completedAt: string | null;
}>;

export type PipelineRunDetail = PipelineRunSummary & Readonly<{
  validationSummary: Readonly<Record<string, unknown>>;
  artifactManifest: PipelineArtifactManifest;
  findings: readonly PipelineProductFinding[];
  inputs: readonly Omit<PipelinePublicationInput, "rows">[];
  rejectionReason: string | null;
  publicationReason: string | null;
  datasetId: string | null;
}>;

export type PipelineReleaseMemberSelection = Readonly<{
  inputKey: Tier1ReleaseInputKey;
  publicationId: string;
  expectedChecksum: string;
}>;

export type FinalizePipelineReleaseInput = Readonly<{
  releaseKey: string;
  resourceSetId: string;
  registryRevisionId: string;
  ruleVersion: string;
  ruleChecksum: string;
  priorities: readonly Tier1PriorityRule[];
  members: readonly PipelineReleaseMemberSelection[];
  actorOwnerId: string;
  actorEmail: string | null;
  reason: string;
}>;

export type CreatePipelineReleaseCandidateInput = Omit<
  FinalizePipelineReleaseInput,
  "reason"
>;

export type DecidePipelineReleaseCandidateInput = Readonly<{
  releaseSetId: string;
  actorOwnerId: string;
  actorEmail: string | null;
  reason: string;
}>;

export type PipelineComparisonReport = Readonly<{
  schemaVersion: 1;
  definitionKey: string;
  currentChecksum: string;
  retainedChecksum: string;
  currentRowCount: number;
  retainedRowCount: number;
  onlyCurrentKeys: readonly string[];
  onlyRetainedKeys: readonly string[];
  changedKeys: readonly string[];
  explanations: readonly string[];
}>;

export type PreparedPipelineOutput = Readonly<{
  columns: readonly CsvColumn[];
  rows: readonly Readonly<Record<string, string>>[];
  findings: readonly PipelineProductFinding[];
  outputChecksum: string;
  manifest: PipelineArtifactManifest;
}>;
