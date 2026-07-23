import { IMB_API_CONNECTION_ID } from "@/lib/api-connections";
import {
  assertEligibleDatasetFormingSource,
  assertPublishableDatasetFormingCandidate,
  DATASET_FORMING_STALE_AFTER_MS,
  isStaleDatasetFormingBuild,
} from "@/lib/dataset-forming/policy";
import { datasetFormingEngineRegistry } from "@/lib/dataset-forming/registered-engines";
import { IMB_SOURCE_PROFILE_KEY } from "@/lib/dataset-forming/engines/imb";
import type {
  ApiConnectionRunMode,
  ApiConnectionRunStatus,
} from "@/lib/api-types";

import type {
  ImbFormingDecisionInput,
  ImbFormingRunStatus,
} from "./types";
import { ImbFormingError } from "./types";

export const FORMING_STALE_AFTER_MS = DATASET_FORMING_STALE_AFTER_MS;
export const FORMING_PUBLICATION_STALE_AFTER_MS = 15 * 60 * 1_000;

export function assertEligibleImbSource(input: {
  connectionId: string;
  status: ApiConnectionRunStatus;
  mode: ApiConnectionRunMode;
  rowsChecksum: string | null;
  rawChecksum: string | null;
}) {
  if (input.connectionId !== IMB_API_CONNECTION_ID) {
    throw new ImbFormingError(
      "Forming candidates are currently available only for IMB.",
      404,
    );
  }
  try {
    assertEligibleDatasetFormingSource({
      sourceProfileKey: IMB_SOURCE_PROFILE_KEY,
      status: input.status,
      mode: input.mode,
      rowsChecksum: input.rowsChecksum,
      rawChecksum: input.rawChecksum,
      registry: datasetFormingEngineRegistry,
    });
  } catch (error) {
    if (input.status !== "success" || input.mode !== "import") {
      throw new ImbFormingError("A successful IMB ingestion run is required.", 409);
    }
    if (!input.rowsChecksum || !input.rawChecksum) {
      throw new ImbFormingError(
        "This IMB run predates immutable artifact checksums. Start a new ingestion first.",
        409,
      );
    }
    throw error;
  }
}

export function isStaleImbBuild(createdAt: Date, now = Date.now()) {
  return isStaleDatasetFormingBuild(createdAt, now);
}

export function isStaleImbPublication(
  publishingStartedAt: Date | null,
  now = Date.now(),
) {
  return (
    publishingStartedAt === null ||
    publishingStartedAt.getTime() <= now - FORMING_PUBLICATION_STALE_AFTER_MS
  );
}

export function assertPublishableImbCandidate(input: {
  status: ImbFormingRunStatus;
  warningCount: number;
  decision: ImbFormingDecisionInput;
}) {
  try {
    assertPublishableDatasetFormingCandidate(input);
  } catch (error) {
    if (input.status !== "valid") {
      throw new ImbFormingError("Only a valid candidate can be published.", 409);
    }
    if (!input.decision.reason.trim()) {
      throw new ImbFormingError("A publication reason is required.");
    }
    if (input.warningCount > 0 && !input.decision.warningsAcknowledged) {
      throw new ImbFormingError(
        "Acknowledge the candidate warnings before publishing.",
        409,
      );
    }
    throw error;
  }
}

export function assertDatasetFormingPublicationTargetCurrent(input: {
  expectedCurrentPublicationId: string | null;
  currentPublicationId: string | null;
}) {
  if (input.expectedCurrentPublicationId !== input.currentPublicationId) {
    throw new ImbFormingError(
      "A newer formed dataset was published after this candidate was created. Rebuild and review the candidate again.",
      409,
    );
  }
}
