import {
  buildOperationalAlertEmail,
  type OperationalAlertNotification,
} from "../../supabase/functions/_shared/operational-alert";

export type OperationalAlertEmailInput = {
  idempotencyKey: string;
  severity: "critical" | "high";
  source: string;
  title: string;
  summary: string;
  occurredAt: string;
  occurrenceCount?: number;
  detailsUrl?: string;
};

type SendOperationalAlertEmailOptions = {
  environment?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

type OperationalEmailConfig = {
  apiKey: string;
  sender: string;
  recipient: string;
  detailsUrl?: string;
};

export class OperationalAlertEmailError extends Error {
  code: string;
  status?: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = "OperationalAlertEmailError";
    this.code = code;
    this.status = status;
  }
}

function readRequiredEnvironment(
  environment: Record<string, string | undefined>,
  name: string,
) {
  const value = environment[name]?.trim();

  if (!value) {
    throw new OperationalAlertEmailError(
      "operational_email_not_configured",
      "Operational email delivery is not configured.",
    );
  }

  return value;
}

function readOperationalEmailConfig(
  environment: Record<string, string | undefined>,
): OperationalEmailConfig {
  return {
    apiKey: readRequiredEnvironment(environment, "RESEND_OPERATIONAL_API_KEY"),
    sender: readRequiredEnvironment(environment, "OPERATIONAL_ALERT_FROM"),
    recipient: readRequiredEnvironment(environment, "OPERATIONAL_ALERT_RECIPIENT"),
    detailsUrl: environment.OPERATIONAL_ALERT_DETAILS_URL?.trim() || undefined,
  };
}

function assertIdempotencyKey(value: string) {
  if (!/^[A-Za-z0-9._:-]{8,200}$/.test(value)) {
    throw new OperationalAlertEmailError(
      "invalid_idempotency_key",
      "Operational email idempotency key is invalid.",
    );
  }
}

export async function sendOperationalAlertEmail(
  input: OperationalAlertEmailInput,
  options: SendOperationalAlertEmailOptions = {},
) {
  const environment = options.environment ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 5000;
  const config = readOperationalEmailConfig(environment);

  assertIdempotencyKey(input.idempotencyKey);

  const notification: OperationalAlertNotification = {
    id: input.idempotencyKey,
    idempotency_key: input.idempotencyKey,
    fingerprint: input.idempotencyKey,
    severity: input.severity,
    source: input.source,
    title: input.title,
    summary: input.summary,
    details_url: input.detailsUrl ?? null,
    occurrence_count: input.occurrenceCount ?? 1,
    attempt_count: 1,
    created_at: input.occurredAt,
  };
  const email = buildOperationalAlertEmail(notification, config.detailsUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;

  try {
    response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        from: config.sender,
        to: [config.recipient],
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
      signal: controller.signal,
    });
  } catch {
    throw new OperationalAlertEmailError(
      "resend_network_error",
      "Operational email provider could not be reached.",
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new OperationalAlertEmailError(
      `resend_http_${response.status}`,
      "Operational email provider rejected the request.",
      response.status,
    );
  }

  const result = (await response.json()) as { id?: unknown };

  if (typeof result.id !== "string" || !result.id) {
    throw new OperationalAlertEmailError(
      "resend_invalid_response",
      "Operational email provider returned an invalid response.",
    );
  }

  return { id: result.id };
}
