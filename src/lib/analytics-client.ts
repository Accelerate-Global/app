"use client";

import type { AppAnalyticsEventMap, AppAnalyticsEventName } from "@/lib/analytics";
import { sanitizeAnalyticsPayload } from "@/lib/analytics";
import { logError } from "@/lib/error-logging";

const ANALYTICS_INGEST_PATH = "/api/analytics/events";

function persistAppEvent(
  name: AppAnalyticsEventName,
  payload: Record<string, string | number | boolean | null>,
) {
  const body = JSON.stringify({ name, payload });

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const sent = navigator.sendBeacon(
      ANALYTICS_INGEST_PATH,
      new Blob([body], { type: "application/json" }),
    );

    if (sent) {
      return;
    }
  }

  void fetch(ANALYTICS_INGEST_PATH, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body,
    keepalive: true,
  }).catch((error) => {
    logError("Failed to persist analytics event", error);
  });
}

export function trackAppEvent<Name extends AppAnalyticsEventName>(
  name: Name,
  payload: AppAnalyticsEventMap[Name],
) {
  const sanitizedPayload = sanitizeAnalyticsPayload(payload);

  if (
    sanitizedPayload.workspace_role === "anonymous" ||
    sanitizedPayload.actor_owner_id === "anonymous"
  ) {
    return;
  }

  try {
    persistAppEvent(name, sanitizedPayload);
  } catch (error) {
    logError("Failed to queue analytics persistence", error);
  }
}
