"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/react";

import { isVercelAnalyticsPaused, redactAnalyticsUrl } from "@/lib/analytics";

function beforeSendAnalyticsEvent(event: BeforeSendEvent) {
  return {
    ...event,
    url: redactAnalyticsUrl(event.url),
  };
}

export function VercelAnalytics() {
  if (isVercelAnalyticsPaused()) {
    return null;
  }

  return <Analytics beforeSend={beforeSendAnalyticsEvent} />;
}
