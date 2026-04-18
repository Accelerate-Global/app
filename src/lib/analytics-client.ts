"use client";

import { track } from "@vercel/analytics";

import type { AppAnalyticsEventMap, AppAnalyticsEventName } from "@/lib/analytics";
import { sanitizeAnalyticsPayload } from "@/lib/analytics";

export function trackAppEvent<Name extends AppAnalyticsEventName>(
  name: Name,
  payload: AppAnalyticsEventMap[Name],
) {
  try {
    track(name, sanitizeAnalyticsPayload(payload));
  } catch (error) {
    console.error("Failed to track analytics event", error);
  }
}
