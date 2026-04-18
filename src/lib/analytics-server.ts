import { track } from "@vercel/analytics/server";

import type { AppAnalyticsEventMap, AppAnalyticsEventName } from "@/lib/analytics";
import { sanitizeAnalyticsPayload } from "@/lib/analytics";

export async function trackServerAppEvent<Name extends AppAnalyticsEventName>(
  name: Name,
  payload: AppAnalyticsEventMap[Name],
) {
  try {
    await track(name, sanitizeAnalyticsPayload(payload));
  } catch (error) {
    console.error("Failed to track server analytics event", error);
  }
}
