import { beforeEach, describe, expect, it, vi } from "vitest";

import { logError } from "@/lib/error-logging";
import { enqueueOperationalAlert } from "@/lib/operational-alerts";
import {
  buildOperationalCaptureAlert,
  captureOperationalEvent,
} from "./operational-alert-capture";

vi.mock("@/lib/operational-alerts", () => ({
  enqueueOperationalAlert: vi.fn(),
}));
vi.mock("@/lib/error-logging", () => ({ logError: vi.fn() }));

const enqueueOperationalAlertMock = vi.mocked(enqueueOperationalAlert);

describe("operational alert capture policy", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("OPERATIONAL_ALERT_DETAILS_URL", "https://data.accelerateglobal.org");
    enqueueOperationalAlertMock.mockResolvedValue({ queued: true });
  });

  it("builds a fixed sanitized connection alert after a failed run", () => {
    expect(
      buildOperationalCaptureAlert({
        kind: "connection-run-failed",
        connectionId: "11111111-1111-4111-8111-111111111111",
        runId: "22222222-2222-4222-8222-222222222222",
        mode: "test",
        reasonCode: "provider<script> unavailable",
      }),
    ).toEqual({
      idempotencyKey:
        "connection-run:22222222-2222-4222-8222-222222222222:failed",
      fingerprint: "connection-test-unexpected",
      severity: "high",
      source: "connection.test",
      title: "API connection test failed",
      summary:
        "A saved API connection run reached a persisted failed state. Review the protected run details and logs.",
      detailsUrl:
        "https://data.accelerateglobal.org/dashboard/api-connections/11111111-1111-4111-8111-111111111111",
    });
  });

  it("does not copy raw pipeline errors into alert content", () => {
    const alert = buildOperationalCaptureAlert({
      kind: "pipeline-run-failed",
      runId: "run-1",
      flowKey: "tier-1",
      stageKey: "publish",
      effectKey: "storage",
      errorCode: "TOKEN=super-secret<script>",
    });
    const serialized = JSON.stringify(alert);

    expect(alert.title).toBe("Dataset pipeline failed");
    expect(alert.fingerprint).toBe(
      "pipeline-tier-1-publish-storage-pipeline-error",
    );
    expect(serialized).not.toContain("<script>");
    expect(serialized).not.toContain("TOKEN=");
    expect(serialized).not.toContain("super-secret");
  });

  it("uses one global cooldown fingerprint for repeated credential failures", () => {
    expect(
      buildOperationalCaptureAlert({
        kind: "auth-repeated-failures",
        windowId: "11111111-1111-4111-8111-111111111111",
        occurrenceCount: 5,
      }),
    ).toMatchObject({
      idempotencyKey:
        "auth-repeated:11111111-1111-4111-8111-111111111111",
      fingerprint: "auth-repeated-invalid-credentials",
      occurrenceCount: 5,
    });
  });

  it("accepts only fixed upload stages and fixed summaries", () => {
    expect(
      buildOperationalCaptureAlert({
        kind: "dataset-upload-failed",
        operationId: "upload-1",
        stage: "storage-transfer",
      }),
    ).toMatchObject({
      idempotencyKey: "dataset-upload:upload-1:storage-transfer",
      fingerprint: "dataset-upload-storage-transfer",
      title: "Dataset upload failed",
      summary:
        "A confirmed dataset upload failed during the storage-transfer stage.",
    });
  });

  it("delegates to the existing fail-open outbox helper", async () => {
    await expect(
      captureOperationalEvent({
        kind: "auth-system-failed",
        occurrenceId: "request-1",
        reasonCode: "provider_unavailable",
      }),
    ).resolves.toEqual({ queued: true });

    expect(enqueueOperationalAlertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: "critical",
        source: "auth.sign-in",
        fingerprint: "auth-system-provider-error",
      }),
    );
  });

  it("fails open if an unexpected capture dependency throws", async () => {
    enqueueOperationalAlertMock.mockRejectedValue(new Error("unexpected failure"));

    await expect(
      captureOperationalEvent({
        kind: "dataset-upload-failed",
        operationId: "upload-1",
        stage: "parsing",
      }),
    ).resolves.toEqual({ queued: false });
    expect(vi.mocked(logError)).toHaveBeenCalledWith(
      "Operational event capture failed",
      expect.any(Error),
    );
  });

  it("omits details links when the configured base is not HTTPS", () => {
    vi.stubEnv("OPERATIONAL_ALERT_DETAILS_URL", "http://localhost:3000");

    expect(
      buildOperationalCaptureAlert({
        kind: "dataset-upload-failed",
        operationId: "upload-1",
        stage: "parsing",
      }).detailsUrl,
    ).toBeUndefined();
  });
});
