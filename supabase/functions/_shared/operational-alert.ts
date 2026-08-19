export type OperationalAlertNotification = {
  id: string;
  idempotency_key: string;
  fingerprint: string;
  severity: "critical" | "high";
  source: string;
  title: string;
  summary: string;
  details_url: string | null;
  occurrence_count: number;
  attempt_count: number;
  created_at: string;
};

export type OperationalAlertEmail = {
  subject: string;
  text: string;
  html: string;
};

const HTML_ESCAPE_PATTERN = /[&<>'"]/g;
const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;",
};

export function escapeOperationalAlertHtml(value: string) {
  return value.replace(HTML_ESCAPE_PATTERN, (character) => HTML_ESCAPES[character]);
}

export function sanitizeOperationalAlertHeader(value: string) {
  return value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

export function isSafeOperationalDetailsUrl(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function buildOperationalAlertEmail(
  notification: OperationalAlertNotification,
  fallbackDetailsUrl?: string,
): OperationalAlertEmail {
  const severity = notification.severity.toUpperCase();
  const title = sanitizeOperationalAlertHeader(notification.title);
  const source = sanitizeOperationalAlertHeader(notification.source);
  const summary = notification.summary.trim();
  const detailsUrl = isSafeOperationalDetailsUrl(notification.details_url)
    ? notification.details_url
    : isSafeOperationalDetailsUrl(fallbackDetailsUrl)
      ? fallbackDetailsUrl
      : undefined;
  const occurredAt = new Date(notification.created_at).toISOString();
  const subject = `[${severity}] ${title}`;
  const textLines = [
    `${severity} operational incident`,
    "",
    `Area: ${source}`,
    `First detected: ${occurredAt}`,
    `Occurrences: ${notification.occurrence_count}`,
    "",
    summary,
  ];

  if (detailsUrl) {
    textLines.push("", `Details: ${detailsUrl}`);
  }

  const safeSeverity = escapeOperationalAlertHtml(severity);
  const safeTitle = escapeOperationalAlertHtml(title);
  const safeSource = escapeOperationalAlertHtml(source);
  const safeOccurredAt = escapeOperationalAlertHtml(occurredAt);
  const safeOccurrenceCount = escapeOperationalAlertHtml(
    String(notification.occurrence_count),
  );
  const safeSummary = escapeOperationalAlertHtml(summary).replace(/\n/g, "<br />");
  const safeDetailsUrl = detailsUrl ? escapeOperationalAlertHtml(detailsUrl) : undefined;

  return {
    subject,
    text: textLines.join("\n"),
    html: `<!doctype html>
<html>
  <body style="margin:0;background:#f7f6ef;color:#262531;font-family:Arial,sans-serif;">
    <main style="max-width:640px;margin:0 auto;padding:32px 24px;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">${safeSeverity} operational incident</p>
      <h1 style="margin:0 0 24px;font-family:Georgia,serif;font-size:28px;line-height:1.2;">${safeTitle}</h1>
      <dl style="margin:0 0 24px;">
        <dt style="font-weight:700;">Area</dt><dd style="margin:0 0 12px;">${safeSource}</dd>
        <dt style="font-weight:700;">First detected</dt><dd style="margin:0 0 12px;">${safeOccurredAt}</dd>
        <dt style="font-weight:700;">Occurrences</dt><dd style="margin:0;">${safeOccurrenceCount}</dd>
      </dl>
      <p style="line-height:1.6;">${safeSummary}</p>
      ${
        safeDetailsUrl
          ? `<p style="margin-top:24px;"><a href="${safeDetailsUrl}" style="display:inline-block;background:#262531;color:#f7f6ef;padding:10px 16px;text-decoration:none;border-radius:6px;">Open incident details</a></p>`
          : ""
      }
    </main>
  </body>
</html>`,
  };
}

export function isRetryableResendStatus(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

export function operationalAlertErrorCode(status: number) {
  return `resend_http_${status}`;
}
