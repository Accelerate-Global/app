"use client";

import { track } from "@vercel/analytics";

import type { AppAnalyticsEventMap, AppAnalyticsEventName } from "@/lib/analytics";
import { sanitizeAnalyticsPayload } from "@/lib/analytics";

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
    console.error("Failed to persist analytics event", error);
  });
}

export function trackAppEvent<Name extends AppAnalyticsEventName>(
  name: Name,
  payload: AppAnalyticsEventMap[Name],
) {
  const sanitizedPayload = sanitizeAnalyticsPayload(payload);

  try {
    track(name, sanitizedPayload);
  } catch (error) {
    console.error("Failed to track analytics event", error);
  }

  try {
    persistAppEvent(name, sanitizedPayload);
  } catch (error) {
    console.error("Failed to queue analytics persistence", error);
  }
}
