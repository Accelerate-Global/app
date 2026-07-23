import type {
  ApiConnectionRunMode,
  ApiConnectionRunStatus,
} from "@/lib/api-types";

import { DatasetFormingError } from "./errors";
import type {
  DatasetFormingCandidateIntegrity,
  DatasetFormingDecisionInput,
  DatasetFormingRunStatus,
} from "./types";
import { isDatasetFormingChecksum } from "./types";
import type {
  DatasetFormingEngineRegistry,
  DatasetFormingEngineShape,
} from "./registry";

export const DATASET_FORMING_STALE_AFTER_MS = 15 * 60 * 1000;

export function assertEligibleDatasetFormingSource<
  T extends DatasetFormingEngineShape,
>(input: {
  sourceProfileKey: string;
  status: ApiConnectionRunStatus;
  mode: ApiConnectionRunMode;
  rowsChecksum: string | null;
  rawChecksum: string | null;
  registry: DatasetFormingEngineRegistry<T>;
}) {
  const engine = input.registry.requireBySourceProfile(input.sourceProfileKey);
  if (input.status !== "success" || input.mode !== "import") {
    throw new DatasetFormingError(
      "A successful import snapshot is required before forming a dataset candidate.",
      409,
      "ineligible-source-snapshot",
      {
        sourceProfileKey: input.sourceProfileKey,
        status: input.status,
        mode: input.mode,
      },
    );
  }
  if (
    !input.rowsChecksum ||
    !input.rawChecksum ||
    !isDatasetFormingChecksum(input.rowsChecksum) ||
    !isDatasetFormingChecksum(input.rawChecksum)
  ) {
    throw new DatasetFormingError(
      "The import snapshot predates immutable artifact checksums. Start a new ingestion first.",
      409,
      "missing-source-checksum",
      { sourceProfileKey: input.sourceProfileKey },
    );
  }
  return engine;
}

export function isStaleDatasetFormingBuild(
  createdAt: Date,
  now = Date.now(),
) {
  return now - createdAt.getTime() >= DATASET_FORMING_STALE_AFTER_MS;
}

export function assertPublishableDatasetFormingCandidate(input: {
  status: DatasetFormingRunStatus;
  warningCount: number;
  decision: DatasetFormingDecisionInput;
  integrity?: DatasetFormingCandidateIntegrity;
}) {
  if (input.status !== "valid") {
    throw new DatasetFormingError(
      "Only a valid dataset forming candidate can be published.",
      409,
      "candidate-not-publishable",
      { status: input.status },
    );
  }
  if ((input.integrity ?? "current") !== "current") {
    throw new DatasetFormingError(
      "The candidate bindings are stale or invalid and must be rebuilt before publication.",
      409,
      "candidate-not-publishable",
      { integrity: input.integrity },
    );
  }
  if (!input.decision.reason.trim()) {
    throw new DatasetFormingError(
      "A publication reason is required.",
      400,
      "invalid-decision",
    );
  }
  if (input.warningCount > 0 && !input.decision.warningsAcknowledged) {
    throw new DatasetFormingError(
      "Acknowledge the candidate warnings before publishing.",
      409,
      "invalid-decision",
      { warningCount: input.warningCount },
    );
  }
}

export function assertRejectableDatasetFormingCandidate(input: {
  status: DatasetFormingRunStatus;
  decision: DatasetFormingDecisionInput;
}) {
  if (input.status !== "valid" && input.status !== "invalid") {
    throw new DatasetFormingError(
      "Only a completed undecided candidate can be rejected.",
      409,
      "candidate-not-rejectable",
      { status: input.status },
    );
  }
  if (!input.decision.reason.trim()) {
    throw new DatasetFormingError(
      "A rejection reason is required.",
      400,
      "invalid-decision",
    );
  }
}
