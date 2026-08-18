import { beforeEach, describe, expect, it, vi } from "vitest";

import { captureOperationalEvent } from "@/lib/operational-alert-capture";
import {
  captureFailedApiConnectionAccess,
  captureFailedApiConnectionRun,
} from "./failure-alerts";

vi.mock("@/lib/operational-alert-capture", () => ({
  captureOperationalEvent: vi.fn(),
}));

const captureOperationalEventMock = vi.mocked(captureOperationalEvent);

describe("API connection failure alerts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    captureOperationalEventMock.mockResolvedValue({ queued: true });
  });

  it("maps a persisted failed import run to the closed capture policy", async () => {
    await captureFailedApiConnectionRun({
      connectionId: "connection-1",
      runId: "run-1",
      mode: "import",
      reasonCode: "provider-timeout",
    });

    expect(captureOperationalEventMock).toHaveBeenCalledWith({
      kind: "connection-run-failed",
      connectionId: "connection-1",
      runId: "run-1",
      mode: "import",
      reasonCode: "provider-timeout",
    });
  });

  it("maps a protected access failure without arbitrary error text", async () => {
    await captureFailedApiConnectionAccess({
      connectionId: "connection-1",
      occurrenceId: "occurrence-1",
      reasonCode: "google-sheets",
    });

    expect(captureOperationalEventMock).toHaveBeenCalledWith({
      kind: "connection-access-failed",
      connectionId: "connection-1",
      occurrenceId: "occurrence-1",
      reasonCode: "google-sheets",
    });
  });
});
