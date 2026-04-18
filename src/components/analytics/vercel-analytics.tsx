"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/react";

import { redactAnalyticsUrl } from "@/lib/analytics";

function beforeSendAnalyticsEvent(event: BeforeSendEvent) {
  return {
    ...event,
    url: redactAnalyticsUrl(event.url),
  };
}

export function VercelAnalytics() {
  return <Analytics beforeSend={beforeSendAnalyticsEvent} />;
}
