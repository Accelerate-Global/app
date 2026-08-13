import type { CsvColumn } from "@/lib/api-types";

export const AX_IDENTITY_RULES_VERSION = "ax-identity-v3" as const;
export const AX_IDENTITY_NAMESPACE = "people-groups" as const;

export type AxIdentityKind = "pgac" | "pgic";
export type AxIdentityLifecycle = "reserved" | "active" | "cancelled" | "superseded";
export type AxIdentityAssignmentStatus =
  | "reused"
  | "reserved"
  | "pgac-only"
  | "review-required"
  | "conflict"
  | "unassignable";

export type AxIdentityFinding = Readonly<{
  severity: "warning" | "error";
  ruleCode: string;
  sourceRowIndex: number | null;
  stableRowKey: string | null;
  message: string;
  details: Readonly<Record<string, unknown>>;
}>;

export type AxIdentityCodes = Readonly<{
  pgac: string;
  pgic: string | null;
  sixDigit: string;
}>;

export type AxIdentityCandidateRow = Readonly<{
  sourceRowIndex: number;
  stableRowKey: string | null;
  assignmentStatus: AxIdentityAssignmentStatus;
  bindingId: string | null;
  pgacCode: string | null;
  pgicCode: string | null;
  enrichedRow: Readonly<Record<string, string>>;
}>;

export type AxIdentityRunStatus =
  | "building"
  | "valid"
  | "invalid"
  | "rejected"
  | "publishing"
  | "published"
  | "failed"
  | "expired";

export type AxIdentityRunSummary = Readonly<{
  id: string;
  attemptNumber: number;
  sourcePublicationId: string;
  baseRevisionId: string | null;
  sourceProfileKey: string;
  rulesVersion: string;
  rulesChecksum: string;
  resourceBindings: Readonly<Record<string, string>>;
  inputFingerprint: string;
  publicationTargetKey: string;
  expectedCurrentPublicationId: string | null;
  status: AxIdentityRunStatus;
  inputRowCount: number;
  outputRowCount: number | null;
  reusedCount: number;
  reservedCount: number;
  conflictCount: number;
  unassignableCount: number;
  warningCount: number;
  errorCount: number;
  outputChecksum: string | null;
  artifactManifest: Readonly<Record<string, string>>;
  datasetId: string | null;
  publicationId: string | null;
  isCurrentPublication: boolean;
  registryRevisionId: string | null;
  rejectionReason: string | null;
  publicationReason: string | null;
  reservationExpiresAt: string | null;
  createdAt: string;
  completedAt: string | null;
}>;

export type AxIdentityRunDetail = AxIdentityRunSummary &
  Readonly<{
    findings: readonly AxIdentityFinding[];
    rows: readonly AxIdentityCandidateRow[];
    decisions: readonly AxIdentityChangeDecision[];
  }>;

export type AxRegistryRevision = Readonly<{
  id: string;
  revisionNumber: number;
  previousRevisionId: string | null;
  contentChecksum: string;
  bindingCount: number;
  reason: string;
  actorOwnerId: string;
  actorEmail: string | null;
  createdAt: string;
}>;

export type AxIdentityRegistryEntry = Readonly<{
  bindingId: string;
  sourceProfileKey: string;
  stableRowKey: string;
  bindingState: AxIdentityLifecycle;
  identityId: string;
  pgacCode: string;
  pgicCode: string | null;
  allocatedValue: number | null;
  normalizedIso3: string | null;
  identityEvidence: Readonly<Record<string, unknown>>;
  activatedRevisionId: string | null;
  createdAt: string;
}>;

export type PipelinePublication = Readonly<{
  id: string;
  producerKind: string;
  producerRunId: string;
  datasetId: string;
  sourceProfileKey: string | null;
  publicationTargetKey: string | null;
  registryRevisionId: string | null;
  outputChecksum: string;
  rowCount: number;
  artifactManifest: Readonly<Record<string, string>>;
  createdAt: string;
}>;

export type AxIdentityPublicationResult = Readonly<{
  revisionId: string;
  publicationId: string;
  datasetId: string;
}>;

export type AxIdentityPublishInput = Readonly<{
  runId: string;
  reason: string;
  actorOwnerId: string;
  actorEmail: string | null;
}>;

export type AxIdentityArtifactKind = "rows" | "findings" | "manifest" | "csv";

export type AxIdentityPreparedArtifacts = Readonly<{
  rowsJson: string;
  findingsJson: string;
  manifestJson: string;
  csv: string;
  csvChecksum: string;
  outputChecksum: string;
  columns: readonly CsvColumn[];
}>;

export type AxIdentityAuthorityStatus = Readonly<{
  initialized: boolean;
  environment: string | null;
  registryRevisionId: string | null;
  revisionNumber: number | null;
  rulesChecksum: string | null;
  formatterChecksum: string | null;
  activatedAt: string | null;
}>;

export type AxIdentityChangeAction =
  | "rebind"
  | "new-identity"
  | "canonical-supersession";

export type AxIdentityChangeDecision = Readonly<{
  id: string;
  identityRunId: string;
  sourceRowIndex: number;
  sourceProfileKey: string;
  stableRowKey: string;
  currentBindingId: string;
  currentEvidence: Readonly<Record<string, unknown>>;
  proposedEvidence: Readonly<Record<string, unknown>>;
  allowedActions: readonly AxIdentityChangeAction[];
  selectedAction: AxIdentityChangeAction | null;
  selectedAt: string | null;
}>;
