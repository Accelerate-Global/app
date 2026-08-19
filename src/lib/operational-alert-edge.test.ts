import { describe, expect, it, vi } from "vitest";

import {
  buildOperationalAlertEmail,
  isRetryableResendStatus,
  type OperationalAlertNotification,
} from "../../supabase/functions/_shared/operational-alert";
import { createOperationalAlertHandler } from "../../supabase/functions/send-operational-alert/handler";

const NOTIFICATION: OperationalAlertNotification = {
  id: "11111111-1111-4111-8111-111111111111",
  idempotency_key: "dataset-refresh-2026-08-18t18",
  fingerprint: "dataset-refresh-timeout",
  severity: "high",
  source: "dataset.refresh",
  title: "Dataset refresh failed",
  summary: "The provider timed out after the retry budget was exhausted.",
  details_url: "https://data.accelerateglobal.org/admin/operations",
  occurrence_count: 3,
  attempt_count: 1,
  created_at: "2026-08-18T18:00:00.000Z",
};

const ENVIRONMENT = {
  OPERATIONAL_ALERT_DISPATCH_SECRET: "dispatch-secret",
  RESEND_OPERATIONAL_API_KEY: "resend-secret",
  OPERATIONAL_ALERT_FROM: "Accelerate Global Alerts <alerts@accelerateglobal.org>",
  OPERATIONAL_ALERT_RECIPIENT: "developer@example.com",
  OPERATIONAL_ALERT_DETAILS_URL:
    "https://data.accelerateglobal.org/admin/operations",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
};

function createHandler(
  fetchMock: ReturnType<typeof vi.fn>,
  environment: Record<string, string | undefined> = ENVIRONMENT,
) {
  return createOperationalAlertHandler({
    fetch: fetchMock as typeof fetch,
    getEnvironment: (name) => environment[name],
  });
}

function createRequest(authorization = "Bearer dispatch-secret") {
  return new Request("https://project.supabase.co/functions/v1/send-operational-alert", {
    method: "POST",
    headers: { authorization },
  });
}

describe("operational alert email rendering", () => {
  it("escapes dynamic HTML while preserving plain text", () => {
    const email = buildOperationalAlertEmail({
      ...NOTIFICATION,
      title: "Failure <script>alert('x')</script>",
      summary: "First line & second line\n<a href='bad'>bad</a>",
    });

    expect(email.subject).toBe("[HIGH] Failure <script>alert('x')</script>");
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<a href='bad'>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("First line &amp; second line<br />");
  });

  it("rejects non-HTTPS detail links", () => {
    const email = buildOperationalAlertEmail({
      ...NOTIFICATION,
      details_url: "javascript:alert(1)",
    });

    expect(email.html).not.toContain("Open incident details");
    expect(email.text).not.toContain("javascript:");
  });

  it("classifies transient Resend statuses for retry", () => {
    expect(isRetryableResendStatus(408)).toBe(true);
    expect(isRetryableResendStatus(429)).toBe(true);
    expect(isRetryableResendStatus(503)).toBe(true);
    expect(isRetryableResendStatus(400)).toBe(false);
    expect(isRetryableResendStatus(403)).toBe(false);
  });
});

describe("send-operational-alert Edge Function handler", () => {
  it("fails closed before any provider call when configuration is incomplete", async () => {
    const fetchMock = vi.fn();
    const handler = createHandler(fetchMock, {
      ...ENVIRONMENT,
      RESEND_OPERATIONAL_API_KEY: "",
    });

    const response = await handler(createRequest());

    expect(response.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid dispatch bearer secret before claiming work", async () => {
    const fetchMock = vi.fn();
    const handler = createHandler(fetchMock);

    const response = await handler(createRequest("Bearer wrong-secret"));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a clean success when no alerts are pending", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json([]));
    const handler = createHandler(fetchMock);

    const response = await handler(createRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      claimed: 0,
      sent: 0,
      failed: 0,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "/rpc/claim_operational_alert_notifications",
    );
  });

  it("sends a claimed alert with one recipient and completes its outbox row", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json([NOTIFICATION]))
      .mockResolvedValueOnce(Response.json({ id: "resend-message-id" }))
      .mockResolvedValueOnce(Response.json(true));
    const handler = createHandler(fetchMock);

    const response = await handler(createRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      claimed: 1,
      sent: 1,
      failed: 0,
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.resend.com/emails");

    const resendInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(resendInit.headers).toMatchObject({
      Authorization: "Bearer resend-secret",
      "Idempotency-Key": NOTIFICATION.idempotency_key,
    });
    expect(JSON.parse(String(resendInit.body))).toMatchObject({
      to: ["developer@example.com"],
      subject: "[HIGH] Dataset refresh failed",
    });
    expect(fetchMock.mock.calls[2]?.[0]).toContain(
      "/rpc/complete_operational_alert_notification",
    );
  });

  it("records a retryable Resend rate-limit response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json([NOTIFICATION]))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(Response.json(true));
    const handler = createHandler(fetchMock);

    const response = await handler(createRequest());

    await expect(response.json()).resolves.toEqual({
      ok: false,
      claimed: 1,
      sent: 0,
      failed: 1,
    });
    const failureBody = JSON.parse(
      String((fetchMock.mock.calls[2]?.[1] as RequestInit).body),
    );
    expect(failureBody).toMatchObject({
      p_error_code: "resend_http_429",
      p_retryable: true,
    });
  });

  it("records a terminal Resend validation response without retrying", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json([NOTIFICATION]))
      .mockResolvedValueOnce(new Response(null, { status: 400 }))
      .mockResolvedValueOnce(Response.json(true));
    const handler = createHandler(fetchMock);

    await handler(createRequest());

    const failureBody = JSON.parse(
      String((fetchMock.mock.calls[2]?.[1] as RequestInit).body),
    );
    expect(failureBody).toMatchObject({
      p_error_code: "resend_http_400",
      p_retryable: false,
    });
  });

  it("records a retryable provider network failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json([NOTIFICATION]))
      .mockRejectedValueOnce(new TypeError("network unavailable"))
      .mockResolvedValueOnce(Response.json(true));
    const handler = createHandler(fetchMock);

    await handler(createRequest());

    const failureBody = JSON.parse(
      String((fetchMock.mock.calls[2]?.[1] as RequestInit).body),
    );
    expect(failureBody).toMatchObject({
      p_error_code: "resend_network_error",
      p_retryable: true,
    });
  });
});
