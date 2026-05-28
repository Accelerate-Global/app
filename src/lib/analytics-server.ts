import { track } from "@vercel/analytics/server";

import type { AppAnalyticsEventMap, AppAnalyticsEventName } from "@/lib/analytics";
import { isVercelAnalyticsPaused, sanitizeAnalyticsPayload } from "@/lib/analytics";
import { persistAnalyticsEvent } from "@/lib/analytics-store";
import { logError } from "@/lib/error-logging";

export async function trackServerAppEvent<Name extends AppAnalyticsEventName>(
  name: Name,
  payload: AppAnalyticsEventMap[Name],
) {
  const sanitizedPayload = sanitizeAnalyticsPayload(payload);
  const shouldTrackVercel = !isVercelAnalyticsPaused();
  const [vercelTrackResult, persistResult] = await Promise.allSettled([
    shouldTrackVercel ? track(name, sanitizedPayload) : Promise.resolve(),
    persistAnalyticsEvent(name, sanitizedPayload),
  ]);

  if (shouldTrackVercel && vercelTrackResult.status === "rejected") {
    logError("Failed to track server analytics event", vercelTrackResult.reason);
  }

  if (persistResult.status === "rejected") {
    logError("Failed to persist server analytics event", persistResult.reason);
  }
}
