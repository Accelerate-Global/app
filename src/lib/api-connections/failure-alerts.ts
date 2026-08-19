import { captureOperationalEvent } from "@/lib/operational-alert-capture";

export function captureFailedApiConnectionRun(input: {
  connectionId: string;
  runId: string;
  mode: "test" | "import";
  reasonCode?: string | null;
}) {
  return captureOperationalEvent({
    kind: "connection-run-failed",
    ...input,
  });
}

export function captureFailedApiConnectionAccess(input: {
  connectionId: string;
  occurrenceId: string;
  reasonCode?: string | null;
}) {
  return captureOperationalEvent({
    kind: "connection-access-failed",
    ...input,
  });
}
