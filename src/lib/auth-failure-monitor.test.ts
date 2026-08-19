import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { logError } from "@/lib/error-logging";
import { captureOperationalEvent } from "@/lib/operational-alert-capture";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  hashAuthFailureSubject,
  recordInvalidCredentialFailure,
  resetInvalidCredentialFailures,
} from "./auth-failure-monitor";

vi.mock("@/lib/error-logging", () => ({ logError: vi.fn() }));
vi.mock("@/lib/operational-alert-capture", () => ({
  captureOperationalEvent: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

const createSupabaseAdminClientMock = vi.mocked(createSupabaseAdminClient);
const captureOperationalEventMock = vi.mocked(captureOperationalEvent);
const logErrorMock = vi.mocked(logError);

describe("authentication failure monitor", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("AUTH_FAILURE_HASH_SECRET", "a-private-secret-with-at-least-32-characters");
    captureOperationalEventMock.mockResolvedValue({ queued: true });
  });

  it("normalizes email before producing a keyed one-way subject", () => {
    expect(hashAuthFailureSubject("  Viewer@Example.com ")).toBe(
      createHmac("sha256", "a-private-secret-with-at-least-32-characters")
        .update("viewer@example.com")
        .digest("hex"),
    );
    expect(hashAuthFailureSubject("viewer@example.com")).not.toContain(
      "viewer@example.com",
    );
  });

  it("records invalid credentials without alerting below threshold", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        recorded: true,
        should_alert: false,
        failure_count: 4,
        window_id: "11111111-1111-4111-8111-111111111111",
      },
      error: null,
    });
    createSupabaseAdminClientMock.mockReturnValue({ rpc } as never);

    await expect(
      recordInvalidCredentialFailure("viewer@example.com"),
    ).resolves.toMatchObject({
      recorded: true,
      shouldAlert: false,
      failureCount: 4,
    });
    expect(captureOperationalEventMock).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith(
      "record_auth_failure",
      expect.objectContaining({
        p_subject_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
        p_window_minutes: 15,
        p_threshold: 5,
      }),
    );
  });

  it("alerts once when the database marks the threshold crossing", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        recorded: true,
        should_alert: true,
        failure_count: 5,
        window_id: "11111111-1111-4111-8111-111111111111",
      },
      error: null,
    });
    createSupabaseAdminClientMock.mockReturnValue({ rpc } as never);

    await recordInvalidCredentialFailure("viewer@example.com");

    expect(captureOperationalEventMock).toHaveBeenCalledWith({
      kind: "auth-repeated-failures",
      windowId: "11111111-1111-4111-8111-111111111111",
      occurrenceCount: 5,
    });
  });

  it("fails open when hashing or persistence is unavailable", async () => {
    vi.stubEnv("AUTH_FAILURE_HASH_SECRET", "short");

    await expect(
      recordInvalidCredentialFailure("viewer@example.com"),
    ).resolves.toEqual({
      recorded: false,
      shouldAlert: false,
      failureCount: 0,
      windowId: null,
    });
    expect(logErrorMock).toHaveBeenCalledWith(
      "Failed to record invalid credential attempt",
      expect.any(Error),
    );
  });

  it("resets the keyed counter without exposing the email", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    createSupabaseAdminClientMock.mockReturnValue({ rpc } as never);

    await resetInvalidCredentialFailures("viewer@example.com");

    expect(rpc).toHaveBeenCalledWith("reset_auth_failures", {
      p_subject_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("viewer@example.com");
  });
});
