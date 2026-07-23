export const PIPELINE_FLOW_STATUSES = [
  "queued",
  "running",
  "awaiting_review",
  "succeeded",
  "failed",
  "cancelled",
] as const;

export type PipelineFlowStatus = (typeof PIPELINE_FLOW_STATUSES)[number];

export const PIPELINE_STAGE_STATUSES = [
  "blocked",
  "queued",
  "claimed",
  "awaiting_review",
  "succeeded",
  "retryable",
  "failed",
  "skipped",
] as const;

export type PipelineStageStatus = (typeof PIPELINE_STAGE_STATUSES)[number];

export type PipelineLaunchKind = "manual" | "schedule" | "backfill" | "rebuild";

export type PipelineStageKind =
  | "ingestion"
  | "forming"
  | "identity"
  | "release"
  | "merge"
  | "aggregate"
  | "publication"
  | "review";

export type PipelineJsonObject = Readonly<Record<string, unknown>>;

export type PipelineStageDefinition = Readonly<{
  key: string;
  label: string;
  description: string;
  kind: PipelineStageKind;
  effectKey: string;
  maxAttempts: number;
  sourceProfileKey?: string;
  productKey?: string;
}>;

export type PipelineDefinitionSemanticDependency = Readonly<{
  kind:
    | "source-engine"
    | "source-adapter"
    | "field-contract"
    | "transformation-contract"
    | "product-definition";
  key: string;
  version: string;
  checksum: string;
}>;

export type PipelineFlowDefinition = Readonly<{
  key: string;
  label: string;
  description: string;
  version: string;
  checksum: string;
  scheduleEligible: boolean;
  semanticDependencies: readonly PipelineDefinitionSemanticDependency[];
  stages: readonly PipelineStageDefinition[];
}>;

export type PipelineRunSummary = Readonly<{
  id: string;
  definitionKey: string;
  definitionVersion: string;
  definitionChecksum: string;
  correlationId: string;
  launchKind: PipelineLaunchKind;
  inputFingerprint: string;
  status: PipelineFlowStatus;
  currentStageKey: string | null;
  actorOwnerId: string;
  actorEmail: string | null;
  progressCurrent: number;
  progressTotal: number;
  rowCount: number | null;
  warningCount: number;
  errorCount: number;
  publicationId: string | null;
  outOfDate: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  stageCount: number;
  completedStageCount: number;
  retryCount: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type PipelineStageAttempt = Readonly<{
  id: string;
  attemptNumber: number;
  workerId: string;
  status: "claimed" | "succeeded" | "awaiting_review" | "failed" | "interrupted";
  retryable: boolean | null;
  progress: PipelineJsonObject;
  output: PipelineJsonObject;
  findingSummary: PipelineJsonObject;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string;
  heartbeatAt: string;
  completedAt: string | null;
}>;

export type PipelineStageDetail = Readonly<{
  id: string;
  key: string;
  index: number;
  kind: PipelineStageKind;
  effectKey: string;
  status: PipelineStageStatus;
  maxAttempts: number;
  attemptCount: number;
  progressCurrent: number;
  progressTotal: number;
  exactInputs: PipelineJsonObject;
  output: PipelineJsonObject;
  findingSummary: PipelineJsonObject;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  attempts: readonly PipelineStageAttempt[];
}>;

export type PipelineRunEvent = Readonly<{
  id: number;
  stageId: string | null;
  eventType: string;
  safeMessage: string;
  details: PipelineJsonObject;
  actorOwnerId: string | null;
  createdAt: string;
}>;

export type PipelineRunDetail = PipelineRunSummary &
  Readonly<{
    exactInputs: PipelineJsonObject;
    stages: readonly PipelineStageDetail[];
    events: readonly PipelineRunEvent[];
  }>;

export type PipelineStageClaim = Readonly<{
  stageId: string;
  attemptId: string;
  flowRunId: string;
  definitionKey: string;
  actorOwnerId: string;
  actorEmail: string | null;
  stageKey: string;
  stageKind: PipelineStageKind;
  effectKey: string;
  exactInputs: PipelineJsonObject;
  attemptNumber: number;
  maxAttempts: number;
  leaseExpiresAt: string;
}>;

export type PipelineStageResult = Readonly<{
  outcome: "succeeded" | "awaiting_review";
  output?: PipelineJsonObject;
  findingSummary?: PipelineJsonObject;
  rowCount?: number | null;
}>;

export type PipelineStageHandlerContext = Readonly<{
  claim: PipelineStageClaim;
  reportProgress(current: number, total: number): Promise<void>;
}>;

export type PipelineStageHandler = (
  context: PipelineStageHandlerContext,
) => Promise<PipelineStageResult>;

export type PipelineStageHandlers = Readonly<Record<string, PipelineStageHandler>>;

export type PipelineScheduleState = Readonly<{
  definitionKey: string;
  sourceProfileId: string | null;
  enabled: boolean;
  intervalMinutes: number;
  manualCanaryRunId: string | null;
  manualCanaryVerifiedAt: string | null;
  manualCanaryVerifiedBy: string | null;
  lastEnqueuedAt: string | null;
  updatedAt: string;
}>;
