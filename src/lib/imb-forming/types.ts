import type { CsvColumn } from "@/lib/api-types";
import type {
  DatasetFormingArtifactKind,
  DatasetFormingArtifactManifest,
  DatasetFormingDecisionInput,
  DatasetFormingFinding,
  DatasetFormingFindingSeverity,
  DatasetFormingLineageManifest,
  DatasetFormingResourceBinding,
  DatasetFormingRunStatus,
  DatasetFormingValidationSummary,
} from "@/lib/dataset-forming/types";
import type { AxIdentityRunStatus } from "@/lib/identity-registry/types";

export type ImbFormingRunStatus = DatasetFormingRunStatus;

export type ImbFormingFindingSeverity = DatasetFormingFindingSeverity;

export type ImbFormingFinding = DatasetFormingFinding;

export type ImbFormingValidationSummary = DatasetFormingValidationSummary<{
  inputRowCount?: number;
  outputRowCount?: number;
  missingStableKeyRows?: number;
  duplicateStableKeyRows?: number;
  duplicateDomainKeyRows?: number;
  unresolvedCountryRows: number;
  ambiguousCountryRows?: number;
  unresolvedRopRows: number;
  countryConflictRows: number;
  ropParentConflictRows: number;
  invalidValueCount: number;
  schemaDriftFields: string[];
}>;

export type ImbFormingArtifactKind = DatasetFormingArtifactKind;

export type ImbFormingArtifactManifest = DatasetFormingArtifactManifest;

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
  /** Generic lineage retained alongside the legacy IMB projection. */
  datasetForming?: DatasetFormingLineageManifest<ImbFormingValidationSummary>;
};

export type ImbFormingDownstreamIdentityRun = Readonly<{
  runId: string;
  status: AxIdentityRunStatus;
  publicationId: string | null;
  registryRevisionId: string | null;
}>;

export type ImbFormingRun = {
  id: string;
  connectionId: string;
  sourceRunId: string;
  resourceSetId: string;
  resourceSetChecksum: string;
  countryVersionId: string;
  ropVersionId: string;
  sourceProfileKey: string;
  engineKey: string;
  engineLabel: string;
  artifactSchemaVersion: number;
  inputFingerprint: string;
  attemptNumber: number;
  publicationTargetKey: string;
  expectedCurrentPublicationId: string | null;
  resourceBindings: DatasetFormingResourceBinding[];
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
  publicationId: string | null;
  downstreamIdentityRun: ImbFormingDownstreamIdentityRun | null;
  rejectionReason: string | null;
  rejectedByOwnerId: string | null;
  rejectedAt: string | null;
  publicationReason: string | null;
  warningsAcknowledged: boolean;
  publishedByOwnerId: string | null;
  publishedAt: string | null;
  publishingStartedAt: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  findings: ImbFormingFinding[];
  findingsTruncated: boolean;
};

export type ImbFormingRunResponse = { formingRun: ImbFormingRun };
export type ImbFormingRunsResponse = { formingRuns: ImbFormingRun[] };

export type ImbFormingDecisionInput = DatasetFormingDecisionInput;

export class ImbFormingError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "ImbFormingError";
  }
}
