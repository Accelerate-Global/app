export const ANALYTICS_FAILURE_TRIAGE_STATUSES = [
  "needs_review",
  "debugging",
  "expected",
  "resolved",
] as const;

export type AnalyticsFailureTriageStatus =
  (typeof ANALYTICS_FAILURE_TRIAGE_STATUSES)[number];

export const ANALYTICS_FAILURE_TRIAGE_STATUS_LABELS = {
  needs_review: "Needs review",
  debugging: "Debugging",
  expected: "Expected",
  resolved: "Resolved",
} as const satisfies Record<AnalyticsFailureTriageStatus, string>;

export const ANALYTICS_FAILURE_TRIAGE_NOTE_MAX_LENGTH = 500;
