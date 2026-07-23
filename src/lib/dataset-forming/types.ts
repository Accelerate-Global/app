import type { CsvColumn } from "@/lib/api-types";

export const DATASET_FORMING_ARTIFACT_SCHEMA_VERSION = 1 as const;

export const DATASET_FORMING_RUN_STATUSES = [
  "building",
  "valid",
  "invalid",
  "rejected",
  "publishing",
  "published",
  "failed",
] as const;

export type DatasetFormingRunStatus =
  (typeof DATASET_FORMING_RUN_STATUSES)[number];

export type DatasetFormingFindingSeverity = "warning" | "error";

export type DatasetFormingFinding = {
  severity: DatasetFormingFindingSeverity;
  ruleCode: string;
  sourceRowIndex: number | null;
  stableRowKey: string | null;
  fieldName: string | null;
  sourceValue: string | null;
  canonicalValue: string | null;
  message: string;
  details: Record<string, unknown>;
};

export type DatasetFormingValidationCounts = {
  warningCount: number;
  errorCount: number;
};

export type DatasetFormingValidationSummary<
  TDetails extends object = Record<never, never>,
> = DatasetFormingValidationCounts & TDetails;

export const DATASET_FORMING_ARTIFACT_KINDS = [
  "rows",
  "findings",
  "manifest",
  "csv",
] as const;

export type DatasetFormingArtifactKind =
  (typeof DATASET_FORMING_ARTIFACT_KINDS)[number];

export type DatasetFormingArtifactManifest = Partial<
  Record<DatasetFormingArtifactKind, string>
>;

export type DatasetFormingArtifactDescriptor = {
  kind: DatasetFormingArtifactKind;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  checksum: string;
};

type DatasetFormingResourceRequirementBase = {
  key: string;
  required: boolean;
};

export type DatasetFormingCatalogResourceRequirement =
  DatasetFormingResourceRequirementBase & {
    bindingType: "catalog";
    expectedKind: string;
    compatibleSchemaVersions: readonly number[];
  };

export type DatasetFormingCodeContractRequirement =
  DatasetFormingResourceRequirementBase & {
    bindingType: "code";
    contractType: string;
    schemaVersion: number;
    version: string;
    checksum: string;
  };

export type DatasetFormingResourceRequirement =
  | DatasetFormingCatalogResourceRequirement
  | DatasetFormingCodeContractRequirement;

export type DatasetFormingResourceBinding = {
  position: number;
  key: string;
  bindingType: "catalog" | "code";
  required: boolean;
  kind: string;
  schemaVersion: number;
  version: string;
  checksum: string;
  resourceSetId: string | null;
  resourceSetChecksum: string | null;
  resourceId: string | null;
  resourceVersionId: string | null;
};

export type DatasetFormingSourceArtifacts = {
  rowsChecksum: string;
  rawChecksum: string;
};

export type DatasetFormingEngineDeclaration = {
  engineKey: string;
  displayName: string;
  sourceProfileKeys: readonly string[];
  version: string;
  checksum: string;
  artifactSchemaVersion: number;
  publicationTargetKey: string;
  resourceRequirements: readonly DatasetFormingResourceRequirement[];
};

export type DatasetFormingContext<TResources> = {
  connectionId: string;
  sourceProfileKey: string;
  sourceRunId: string;
  sourceArtifacts: DatasetFormingSourceArtifacts;
  columns: CsvColumn[];
  rows: Record<string, string>[];
  resourceBindings: readonly DatasetFormingResourceBinding[];
  resources: TResources;
};

export type DatasetFormingResult<
  TValidation extends DatasetFormingValidationCounts = DatasetFormingValidationCounts,
> = {
  columns: CsvColumn[];
  rows: Record<string, string>[];
  findings: DatasetFormingFinding[];
  validation: TValidation;
  outputChecksum: string;
  valid: boolean;
};

export type DatasetFormingEngine<
  TResources,
  TResult extends DatasetFormingResult = DatasetFormingResult,
> = DatasetFormingEngineDeclaration & {
  form(context: DatasetFormingContext<TResources>): TResult;
};

export type DatasetFormingLineageManifest<
  TValidation extends DatasetFormingValidationCounts = DatasetFormingValidationCounts,
> = {
  schemaVersion: 1;
  connectionId: string;
  sourceProfileKey: string;
  sourceRunId: string;
  sourceRowsChecksum: string;
  sourceRawChecksum: string;
  inputFingerprint: string;
  engineKey: string;
  engineVersion: string;
  engineChecksum: string;
  artifactSchemaVersion: number;
  publicationTargetKey: string;
  resourceBindings: DatasetFormingResourceBinding[];
  inputRowCount: number;
  outputRowCount: number;
  outputChecksum: string;
  columns: CsvColumn[];
  validation: TValidation;
};

export type DatasetFormingDecisionInput = {
  reason: string;
  warningsAcknowledged?: boolean;
};

export type DatasetFormingCandidateIntegrity =
  | "current"
  | "stale"
  | "invalid";

export function isDatasetFormingRunStatus(
  value: string,
): value is DatasetFormingRunStatus {
  return (DATASET_FORMING_RUN_STATUSES as readonly string[]).includes(value);
}

export function isDatasetFormingChecksum(value: string) {
  return /^[a-f0-9]{64}$/u.test(value);
}
