import type { AppAnalyticsEventMap, AppAnalyticsEventName } from "@/lib/analytics";
import { sanitizeAnalyticsPayload } from "@/lib/analytics";
import { persistAnalyticsEvent } from "@/lib/analytics-store";
import { logError } from "@/lib/error-logging";

export async function trackServerAppEvent<Name extends AppAnalyticsEventName>(
  name: Name,
  payload: AppAnalyticsEventMap[Name],
) {
  const sanitizedPayload = sanitizeAnalyticsPayload(payload);

  try {
    await persistAnalyticsEvent(name, sanitizedPayload);
  } catch (error) {
    logError("Failed to persist server analytics event", error);
  }
}
