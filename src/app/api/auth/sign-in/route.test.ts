import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  recordInvalidCredentialFailure,
  resetInvalidCredentialFailures,
} from "@/lib/auth-failure-monitor";
import { logError } from "@/lib/error-logging";
import { captureOperationalEvent } from "@/lib/operational-alert-capture";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { POST } from "./route";

vi.mock("node:crypto", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:crypto")>()),
  randomUUID: () => "11111111-1111-4111-8111-111111111111",
}));
vi.mock("@/lib/auth-failure-monitor", () => ({
  recordInvalidCredentialFailure: vi.fn(),
  resetInvalidCredentialFailures: vi.fn(),
}));
vi.mock("@/lib/error-logging", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/error-logging")>()),
  logError: vi.fn(),
}));
vi.mock("@/lib/operational-alert-capture", () => ({
  captureOperationalEvent: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

const createSupabaseServerClientMock = vi.mocked(createSupabaseServerClient);
const recordInvalidCredentialFailureMock = vi.mocked(
  recordInvalidCredentialFailure,
);
const resetInvalidCredentialFailuresMock = vi.mocked(
  resetInvalidCredentialFailures,
);
const captureOperationalEventMock = vi.mocked(captureOperationalEvent);

function request(body: unknown) {
  return new Request("https://data.accelerateglobal.org/api/auth/sign-in", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://data.accelerateglobal.org",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/sign-in", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    recordInvalidCredentialFailureMock.mockResolvedValue({
      recorded: true,
      shouldAlert: false,
      failureCount: 1,
      windowId: "window-1",
    });
    captureOperationalEventMock.mockResolvedValue({ queued: true });
  });

  it("signs in through the SSR client and clears prior failures", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ error: null });
    createSupabaseServerClientMock.mockResolvedValue({
      auth: { signInWithPassword },
    } as never);

    const response = await POST(
      request({ email: "viewer@example.com", password: "SmokePass123!" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "viewer@example.com",
      password: "SmokePass123!",
    });
    expect(resetInvalidCredentialFailuresMock).toHaveBeenCalledWith(
      "viewer@example.com",
    );
  });

  it("counts invalid credentials and returns one generic response", async () => {
    createSupabaseServerClientMock.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          error: { code: "invalid_credentials", message: "Invalid login credentials" },
        }),
      },
    } as never);

    const response = await POST(
      request({ email: "unknown@example.com", password: "wrong-password" }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid email or password.",
    });
    expect(recordInvalidCredentialFailureMock).toHaveBeenCalledWith(
      "unknown@example.com",
    );
    expect(captureOperationalEventMock).not.toHaveBeenCalled();
  });

  it("alerts immediately for provider failures without returning details", async () => {
    createSupabaseServerClientMock.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          error: { code: "over_request_rate_limit", message: "Provider detail" },
        }),
      },
    } as never);

    const response = await POST(
      request({ email: "viewer@example.com", password: "SmokePass123!" }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Authentication is temporarily unavailable. Please try again.",
    });
    expect(captureOperationalEventMock).toHaveBeenCalledWith({
      kind: "auth-system-failed",
      occurrenceId: "11111111-1111-4111-8111-111111111111",
      reasonCode: "over_request_rate_limit",
    });
    expect(vi.mocked(logError)).toHaveBeenCalled();
  });

  it("does not authenticate or alert invalid request bodies", async () => {
    const response = await POST(request({ email: "not-an-email", password: "" }));

    expect(response.status).toBe(400);
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
    expect(captureOperationalEventMock).not.toHaveBeenCalled();
  });
});
