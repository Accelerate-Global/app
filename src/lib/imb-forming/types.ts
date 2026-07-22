import type { CsvColumn } from "@/lib/api-types";

export type ImbFormingRunStatus =
  | "building"
  | "valid"
  | "invalid"
  | "rejected"
  | "publishing"
  | "published"
  | "failed";

export type ImbFormingFindingSeverity = "warning" | "error";

export type ImbFormingFinding = {
  severity: ImbFormingFindingSeverity;
  ruleCode: string;
  sourceRowIndex: number | null;
  stableRowKey: string | null;
  fieldName: string | null;
  sourceValue: string | null;
  canonicalValue: string | null;
  message: string;
  details: Record<string, unknown>;
};

export type ImbFormingValidationSummary = {
  warningCount: number;
  errorCount: number;
  unresolvedCountryRows: number;
  unresolvedRopRows: number;
  countryConflictRows: number;
  ropParentConflictRows: number;
  invalidValueCount: number;
  schemaDriftFields: string[];
};

export type ImbFormingArtifactKind = "rows" | "findings" | "manifest" | "csv";

export type ImbFormingArtifactManifest = Partial<
  Record<ImbFormingArtifactKind, string>
>;

export type ImbFormingResourceBinding = {
  resourceSetId: string;
  resourceSetChecksum: string;
  countryVersionId: string;
  ropVersionId: string;
};

export type ImbFormingLineageManifest = {
  schemaVersion: 1;
  connectionId: string;
  sourceRunId: string;
  sourceRowsChecksum: string;
  sourceRawChecksum: string;
  resourceBinding: ImbFormingResourceBinding;
  fieldContractVersion: number;
  fieldContractChecksum: string;
  transformationVersion: string;
  transformationChecksum: string;
  inputRowCount: number;
  outputRowCount: number;
  outputChecksum: string;
  columns: CsvColumn[];
  validation: ImbFormingValidationSummary;
};

export type ImbFormingRun = {
  id: string;
  connectionId: string;
  sourceRunId: string;
  resourceSetId: string;
  resourceSetChecksum: string;
  countryVersionId: string;
  ropVersionId: string;
  actorOwnerId: string;
  actorEmail: string | null;
  status: ImbFormingRunStatus;
  sourceRowsChecksum: string;
  sourceRawChecksum: string;
  fieldContractVersion: number;
  fieldContractChecksum: string;
  transformationVersion: string;
  transformationChecksum: string;
  inputRowCount: number;
  outputRowCount: number | null;
  warningCount: number;
  errorCount: number;
  validationSummary: ImbFormingValidationSummary;
  artifactManifest: ImbFormingArtifactManifest;
  outputChecksum: string | null;
  outputSizeBytes: number | null;
  datasetId: string | null;
  rejectionReason: string | null;
  rejectedByOwnerId: string | null;
  rejectedAt: string | null;
  publicationReason: string | null;
  warningsAcknowledged: boolean;
  publishedByOwnerId: string | null;
  publishedAt: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  findings: ImbFormingFinding[];
  findingsTruncated: boolean;
};

export type ImbFormingRunResponse = { formingRun: ImbFormingRun };
export type ImbFormingRunsResponse = { formingRuns: ImbFormingRun[] };

export type ImbFormingDecisionInput = {
  reason: string;
  warningsAcknowledged?: boolean;
};

export class ImbFormingError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "ImbFormingError";
  }
}
