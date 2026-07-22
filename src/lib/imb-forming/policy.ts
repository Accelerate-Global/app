import { IMB_API_CONNECTION_ID } from "@/lib/api-connections";
import type {
  ApiConnectionRunMode,
  ApiConnectionRunStatus,
} from "@/lib/api-types";

import type {
  ImbFormingDecisionInput,
  ImbFormingRunStatus,
} from "./types";
import { ImbFormingError } from "./types";

export const FORMING_STALE_AFTER_MS = 15 * 60 * 1000;

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
  if (input.status !== "success" || input.mode !== "import") {
    throw new ImbFormingError("A successful IMB ingestion run is required.", 409);
  }
  if (!input.rowsChecksum || !input.rawChecksum) {
    throw new ImbFormingError(
      "This IMB run predates immutable artifact checksums. Start a new ingestion first.",
      409,
    );
  }
}

export function isStaleImbBuild(createdAt: Date, now = Date.now()) {
  return now - createdAt.getTime() >= FORMING_STALE_AFTER_MS;
}

export function assertPublishableImbCandidate(input: {
  status: ImbFormingRunStatus;
  warningCount: number;
  decision: ImbFormingDecisionInput;
}) {
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
}
