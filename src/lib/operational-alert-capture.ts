import { logError } from "@/lib/error-logging";
import { enqueueOperationalAlert } from "@/lib/operational-alerts";

const SAFE_TOKEN_PATTERN = /[^a-z0-9_-]+/g;
const MAX_TOKEN_LENGTH = 64;
const CONNECTION_FAILURE_REASONS = new Set([
  "missing-connection",
  "connection-disconnected",
  "api-connection",
  "google-sheets",
  "dataset-forming",
  "timeout",
  "unexpected",
  "durable-source-failed",
  "stale-run",
]);
const PIPELINE_FAILURE_REASONS = new Set([
  "stage-adapter-missing",
  "provider-unavailable",
  "stage-execution-failed",
]);
const AUTH_SYSTEM_FAILURE_REASONS = new Set([
  "over_request_rate_limit",
  "request-error",
  "provider-error",
]);

export const UPLOAD_FAILURE_STAGES = [
  "authorization",
  "storage-transfer",
  "parsing",
  "dataset-create",
  "dataset-replace",
  "row-persistence",
  "terminal-import",
] as const;

export type UploadFailureStage = (typeof UPLOAD_FAILURE_STAGES)[number];

export type OperationalCaptureEvent =
  | {
      kind: "connection-run-failed";
      connectionId: string;
      runId: string;
      mode: "test" | "import";
      reasonCode?: string | null;
    }
  | {
      kind: "connection-access-failed";
      connectionId: string;
      occurrenceId: string;
      reasonCode?: string | null;
    }
  | {
      kind: "pipeline-run-failed";
      runId: string;
      flowKey: string;
      stageKey: string;
      effectKey: string;
      errorCode?: string | null;
    }
  | {
      kind: "auth-repeated-failures";
      windowId: string;
      occurrenceCount: number;
    }
  | {
      kind: "auth-system-failed";
      occurrenceId: string;
      reasonCode?: string | null;
    }
  | {
      kind: "dataset-upload-failed";
      operationId: string;
      stage: UploadFailureStage;
      datasetId?: string | null;
    };

export type OperationalCaptureAlert = Parameters<
  typeof enqueueOperationalAlert
>[0];

function safeToken(value: string | null | undefined, fallback = "unknown") {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .replace(SAFE_TOKEN_PATTERN, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_TOKEN_LENGTH);

  return normalized || fallback;
}

function safeIdentifier(value: string, fallback: string) {
  return safeToken(value, fallback);
}

function allowedCategory(
  value: string | null | undefined,
  allowed: ReadonlySet<string>,
  fallback: string,
) {
  const candidate = safeToken(value, fallback);
  return allowed.has(candidate) ? candidate : fallback;
}

function detailsUrl(pathname: string) {
  const configuredBase = process.env.OPERATIONAL_ALERT_DETAILS_URL?.trim();

  if (!configuredBase) return undefined;

  try {
    const url = new URL(pathname, configuredBase);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function buildOperationalCaptureAlert(
  event: OperationalCaptureEvent,
): OperationalCaptureAlert {
  switch (event.kind) {
    case "connection-run-failed": {
      const connectionId = safeIdentifier(event.connectionId, "connection");
      const runId = safeIdentifier(event.runId, "run");
      const reason = allowedCategory(
        event.reasonCode,
        CONNECTION_FAILURE_REASONS,
        "unexpected",
      );
      const isTest = event.mode === "test";

      return {
        idempotencyKey: `connection-run:${runId}:failed`,
        fingerprint: `connection-${event.mode}-${reason}`,
        severity: "high",
        source: `connection.${event.mode}`,
        title: isTest ? "API connection test failed" : "Dataset source pull failed",
        summary:
          "A saved API connection run reached a persisted failed state. Review the protected run details and logs.",
        detailsUrl: detailsUrl(`/dashboard/api-connections/${connectionId}`),
      };
    }

    case "connection-access-failed": {
      const connectionId = safeIdentifier(event.connectionId, "connection");
      const occurrenceId = safeIdentifier(event.occurrenceId, "occurrence");
      const reason = allowedCategory(
        event.reasonCode,
        CONNECTION_FAILURE_REASONS,
        "unexpected",
      );

      return {
        idempotencyKey: `connection-access:${occurrenceId}`,
        fingerprint: `connection-access-${reason}`,
        severity: "high",
        source: "connection.access",
        title: "Connection access check failed",
        summary:
          "A saved source connection could not complete its protected access check.",
        detailsUrl: detailsUrl(`/dashboard/api-connections/${connectionId}`),
      };
    }

    case "pipeline-run-failed": {
      const runId = safeIdentifier(event.runId, "run");
      const flow = safeToken(event.flowKey, "flow");
      const stage = safeToken(event.stageKey, "stage");
      const effect = safeToken(event.effectKey, "effect");
      const code = allowedCategory(
        event.errorCode,
        PIPELINE_FAILURE_REASONS,
        "pipeline-error",
      );

      return {
        idempotencyKey: `pipeline-run:${runId}:failed`,
        fingerprint: `pipeline-${flow}-${stage}-${effect}-${code}`.slice(0, 200),
        severity: "high",
        source: "dataset.pipeline",
        title: "Dataset pipeline failed",
        summary:
          "A dataset pipeline reached a terminal failed state after its configured retry handling.",
        detailsUrl: detailsUrl(`/admin/pipeline-operations?run=${runId}`),
      };
    }

    case "auth-repeated-failures": {
      const windowId = safeIdentifier(event.windowId, "window");

      return {
        idempotencyKey: `auth-repeated:${windowId}`,
        fingerprint: "auth-repeated-invalid-credentials",
        severity: "high",
        source: "auth.sign-in",
        title: "Repeated sign-in failures detected",
        summary:
          "A privacy-safe sign-in counter reached the configured invalid-credential threshold within 15 minutes.",
        occurrenceCount: Math.max(1, Math.min(event.occurrenceCount, 1000)),
        detailsUrl: detailsUrl("/dashboard/user-management"),
      };
    }

    case "auth-system-failed": {
      const occurrenceId = safeIdentifier(event.occurrenceId, "occurrence");
      const reason = allowedCategory(
        event.reasonCode,
        AUTH_SYSTEM_FAILURE_REASONS,
        "provider-error",
      );

      return {
        idempotencyKey: `auth-system:${occurrenceId}`,
        fingerprint: `auth-system-${reason}`,
        severity: "critical",
        source: "auth.sign-in",
        title: "Authentication service failed",
        summary:
          "The application could not complete a password sign-in because of an authentication system error.",
        detailsUrl: detailsUrl("/sign-in"),
      };
    }

    case "dataset-upload-failed": {
      const operationId = safeIdentifier(event.operationId, "operation");
      const datasetId = event.datasetId
        ? safeIdentifier(event.datasetId, "dataset")
        : null;

      return {
        idempotencyKey: `dataset-upload:${operationId}:${event.stage}`,
        fingerprint: `dataset-upload-${event.stage}`,
        severity: "high",
        source: "dataset.upload",
        title: "Dataset upload failed",
        summary: `A confirmed dataset upload failed during the ${event.stage} stage.`,
        detailsUrl: detailsUrl(
          datasetId ? `/dashboard/datasets/${datasetId}` : "/dashboard/upload",
        ),
      };
    }
  }
}

export async function captureOperationalEvent(event: OperationalCaptureEvent) {
  try {
    return await enqueueOperationalAlert(buildOperationalCaptureAlert(event));
  } catch (error) {
    logError("Operational event capture failed", error);
    return { queued: false } as const;
  }
}
