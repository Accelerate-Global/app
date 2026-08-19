import { describe, expect, it, vi } from "vitest";

import {
  OperationalAlertEmailError,
  sendOperationalAlertEmail,
} from "./operational-alert-email";

const ENVIRONMENT = {
  RESEND_OPERATIONAL_API_KEY: "resend-secret",
  OPERATIONAL_ALERT_FROM: "Accelerate Global Alerts <alerts@accelerateglobal.org>",
  OPERATIONAL_ALERT_RECIPIENT: "developer@example.com",
  OPERATIONAL_ALERT_DETAILS_URL:
    "https://data.accelerateglobal.org/admin/operations",
};

const INPUT = {
  idempotencyKey: "supabase-heartbeat-2026-08-18",
  severity: "critical" as const,
  source: "supabase.heartbeat",
  title: "Supabase heartbeat failed",
  summary: "Vercel could not complete the bounded Supabase read checks.",
  occurredAt: "2026-08-18T18:00:00.000Z",
};

describe("sendOperationalAlertEmail", () => {
  it("requires server-only Resend configuration", async () => {
    const fetchMock = vi.fn();

    await expect(
      sendOperationalAlertEmail(INPUT, {
        environment: {},
        fetchImpl: fetchMock,
      }),
    ).rejects.toMatchObject({
      name: "OperationalAlertEmailError",
      code: "operational_email_not_configured",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends one sanitized recipient with a deterministic idempotency key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: "email-id" }));

    await expect(
      sendOperationalAlertEmail(INPUT, {
        environment: ENVIRONMENT,
        fetchImpl: fetchMock,
      }),
    ).resolves.toEqual({ id: "email-id" });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(request.headers).toMatchObject({
      Authorization: "Bearer resend-secret",
      "Idempotency-Key": INPUT.idempotencyKey,
    });
    expect(JSON.parse(String(request.body))).toMatchObject({
      from: ENVIRONMENT.OPERATIONAL_ALERT_FROM,
      to: [ENVIRONMENT.OPERATIONAL_ALERT_RECIPIENT],
      subject: "[CRITICAL] Supabase heartbeat failed",
    });
  });

  it("rejects unsafe idempotency keys before calling Resend", async () => {
    const fetchMock = vi.fn();

    await expect(
      sendOperationalAlertEmail(
        { ...INPUT, idempotencyKey: "bad key\nheader" },
        { environment: ENVIRONMENT, fetchImpl: fetchMock },
      ),
    ).rejects.toMatchObject({ code: "invalid_idempotency_key" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns only a normalized provider status error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        { message: "sensitive provider response must not escape" },
        { status: 429 },
      ),
    );

    const error = await sendOperationalAlertEmail(INPUT, {
      environment: ENVIRONMENT,
      fetchImpl: fetchMock,
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(OperationalAlertEmailError);
    expect(error).toMatchObject({ code: "resend_http_429", status: 429 });
    expect(error.message).not.toContain("sensitive provider response");
  });

  it("normalizes provider timeouts without exposing network details", async () => {
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("request details", "AbortError"));
          });
        }),
    );

    await expect(
      sendOperationalAlertEmail(INPUT, {
        environment: ENVIRONMENT,
        fetchImpl: fetchMock as typeof fetch,
        timeoutMs: 1,
      }),
    ).rejects.toMatchObject({
      code: "resend_network_error",
      message: "Operational email provider could not be reached.",
    });
  });
});
