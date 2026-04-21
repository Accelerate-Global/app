import { track } from "@vercel/analytics/server";

import type { AppAnalyticsEventMap, AppAnalyticsEventName } from "@/lib/analytics";
import { sanitizeAnalyticsPayload } from "@/lib/analytics";
import { persistAnalyticsEvent } from "@/lib/analytics-store";
import { logError } from "@/lib/error-logging";

export async function trackServerAppEvent<Name extends AppAnalyticsEventName>(
  name: Name,
  payload: AppAnalyticsEventMap[Name],
) {
  const sanitizedPayload = sanitizeAnalyticsPayload(payload);
  const results = await Promise.allSettled([
    track(name, sanitizedPayload),
    persistAnalyticsEvent(name, sanitizedPayload),
  ]);

  if (results[0].status === "rejected") {
    logError("Failed to track server analytics event", results[0].reason);
  }

  if (results[1].status === "rejected") {
    logError("Failed to persist server analytics event", results[1].reason);
  }
}
