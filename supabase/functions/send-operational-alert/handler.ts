import {
  buildOperationalAlertEmail,
  isRetryableResendStatus,
  operationalAlertErrorCode,
  type OperationalAlertNotification,
} from "../_shared/operational-alert.ts";

type RuntimeConfig = {
  dispatchSecret: string;
  resendApiKey: string;
  sender: string;
  recipient: string;
  detailsUrl?: string;
  supabaseUrl: string;
  serviceRoleKey: string;
};

type HandlerDependencies = {
  getEnvironment(name: string): string | undefined;
  fetch: typeof fetch;
};

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function readRequiredEnvironment(
  getEnvironment: HandlerDependencies["getEnvironment"],
  name: string,
) {
  const value = getEnvironment(name)?.trim();

  if (!value) {
    throw new Error("Operational alert delivery is not configured.");
  }

  return value;
}

function readRuntimeConfig(
  getEnvironment: HandlerDependencies["getEnvironment"],
): RuntimeConfig {
  return {
    dispatchSecret: readRequiredEnvironment(
      getEnvironment,
      "OPERATIONAL_ALERT_DISPATCH_SECRET",
    ),
    resendApiKey: readRequiredEnvironment(
      getEnvironment,
      "RESEND_OPERATIONAL_API_KEY",
    ),
    sender: readRequiredEnvironment(getEnvironment, "OPERATIONAL_ALERT_FROM"),
    recipient: readRequiredEnvironment(
      getEnvironment,
      "OPERATIONAL_ALERT_RECIPIENT",
    ),
    detailsUrl: getEnvironment("OPERATIONAL_ALERT_DETAILS_URL")?.trim() || undefined,
    supabaseUrl: readRequiredEnvironment(getEnvironment, "SUPABASE_URL"),
    serviceRoleKey: readRequiredEnvironment(
      getEnvironment,
      "SUPABASE_SERVICE_ROLE_KEY",
    ),
  };
}

async function digest(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

async function secretsMatch(candidate: string, expected: string) {
  const [candidateDigest, expectedDigest] = await Promise.all([
    digest(candidate),
    digest(expected),
  ]);
  let difference = 0;

  for (let index = 0; index < expectedDigest.length; index += 1) {
    difference |= candidateDigest[index] ^ expectedDigest[index];
  }

  return difference === 0;
}

function serviceHeaders(config: RuntimeConfig) {
  return {
    ...JSON_HEADERS,
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
  };
}

export function createOperationalAlertHandler(dependencies: HandlerDependencies) {
  async function callRpc<T>(
    config: RuntimeConfig,
    functionName: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const response = await dependencies.fetch(
      `${config.supabaseUrl}/rest/v1/rpc/${functionName}`,
      {
        method: "POST",
        headers: serviceHeaders(config),
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      throw new Error(`Operational alert RPC failed with status ${response.status}.`);
    }

    return (await response.json()) as T;
  }

  async function markFailed(
    config: RuntimeConfig,
    notificationId: string,
    errorCode: string,
    retryable: boolean,
  ) {
    await callRpc<boolean>(config, "fail_operational_alert_notification", {
      p_notification_id: notificationId,
      p_error_code: errorCode,
      p_retryable: retryable,
    });
  }

  async function sendNotification(
    config: RuntimeConfig,
    notification: OperationalAlertNotification,
  ) {
    const email = buildOperationalAlertEmail(notification, config.detailsUrl);
    let response: Response;

    try {
      response = await dependencies.fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          ...JSON_HEADERS,
          Authorization: `Bearer ${config.resendApiKey}`,
          "Idempotency-Key": notification.idempotency_key,
        },
        body: JSON.stringify({
          from: config.sender,
          to: [config.recipient],
          subject: email.subject,
          text: email.text,
          html: email.html,
        }),
      });
    } catch {
      await markFailed(config, notification.id, "resend_network_error", true);
      return { sent: false };
    }

    if (!response.ok) {
      await markFailed(
        config,
        notification.id,
        operationalAlertErrorCode(response.status),
        isRetryableResendStatus(response.status),
      );
      return { sent: false };
    }

    const result = (await response.json()) as { id?: unknown };

    if (typeof result.id !== "string" || !result.id) {
      await markFailed(config, notification.id, "resend_invalid_response", true);
      return { sent: false };
    }

    await callRpc<boolean>(config, "complete_operational_alert_notification", {
      p_notification_id: notification.id,
      p_resend_message_id: result.id,
    });

    return { sent: true };
  }

  return async function handleOperationalAlertRequest(request: Request) {
    if (request.method !== "POST") {
      return jsonResponse({ ok: false, error: "Method not allowed." }, 405);
    }

    let config: RuntimeConfig;

    try {
      config = readRuntimeConfig(dependencies.getEnvironment);
    } catch {
      return jsonResponse(
        { ok: false, error: "Operational alert delivery is unavailable." },
        500,
      );
    }

    const authorization = request.headers.get("authorization") ?? "";
    const expectedAuthorization = `Bearer ${config.dispatchSecret}`;

    if (!(await secretsMatch(authorization, expectedAuthorization))) {
      return jsonResponse({ ok: false, error: "Unauthorized." }, 401);
    }

    let notifications: OperationalAlertNotification[];

    try {
      notifications = await callRpc<OperationalAlertNotification[]>(
        config,
        "claim_operational_alert_notifications",
        { p_limit: 10 },
      );
    } catch {
      return jsonResponse({ ok: false, error: "Could not claim operational alerts." }, 503);
    }

    let sent = 0;
    let failed = 0;

    for (const notification of notifications) {
      try {
        const result = await sendNotification(config, notification);

        if (result.sent) {
          sent += 1;
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;

        try {
          await markFailed(config, notification.id, "delivery_state_error", true);
        } catch {
          // The 15-minute database retry recovers stale claimed notifications.
        }
      }
    }

    return jsonResponse({
      ok: failed === 0,
      claimed: notifications.length,
      sent,
      failed,
    });
  };
}
