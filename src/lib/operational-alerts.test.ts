import { beforeEach, describe, expect, it, vi } from "vitest";

import { logError } from "@/lib/error-logging";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { enqueueOperationalAlert } from "./operational-alerts";

vi.mock("@/lib/error-logging", () => ({
  logError: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

const createSupabaseAdminClientMock = vi.mocked(createSupabaseAdminClient);
const logErrorMock = vi.mocked(logError);

const INPUT = {
  idempotencyKey: "dataset-refresh-2026-08-18t18",
  fingerprint: "dataset-refresh-timeout",
  severity: "high" as const,
  source: "dataset.refresh",
  title: "Dataset refresh failed",
  summary: "The provider timed out after retries were exhausted.",
  detailsUrl: "https://data.accelerateglobal.org",
  occurrenceCount: 3,
};

describe("enqueueOperationalAlert", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("enqueues only the approved operational fields through the service-role RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: "11111111-1111-4111-8111-111111111111",
      error: null,
    });
    createSupabaseAdminClientMock.mockReturnValue({ rpc } as never);

    await expect(enqueueOperationalAlert(INPUT)).resolves.toEqual({
      queued: true,
      notificationId: "11111111-1111-4111-8111-111111111111",
    });
    expect(rpc).toHaveBeenCalledWith("enqueue_operational_alert", {
      p_idempotency_key: INPUT.idempotencyKey,
      p_fingerprint: INPUT.fingerprint,
      p_severity: INPUT.severity,
      p_source: INPUT.source,
      p_title: INPUT.title,
      p_summary: INPUT.summary,
      p_details_url: INPUT.detailsUrl,
      p_occurrence_count: INPUT.occurrenceCount,
    });
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it("fails open and logs normalized details when the outbox RPC rejects", async () => {
    const providerError = new Error("database unavailable");
    const rpc = vi.fn().mockResolvedValue({ data: null, error: providerError });
    createSupabaseAdminClientMock.mockReturnValue({ rpc } as never);

    await expect(enqueueOperationalAlert(INPUT)).resolves.toEqual({ queued: false });
    expect(logErrorMock).toHaveBeenCalledWith(
      "Operational alert enqueue failed",
      providerError,
    );
  });

  it("fails open when the Supabase client cannot be created", async () => {
    const configurationError = new Error("missing server configuration");
    createSupabaseAdminClientMock.mockImplementation(() => {
      throw configurationError;
    });

    await expect(enqueueOperationalAlert(INPUT)).resolves.toEqual({ queued: false });
    expect(logErrorMock).toHaveBeenCalledWith(
      "Operational alert enqueue failed",
      configurationError,
    );
  });
});
