export const WATCHLIST_FIXED_ENGAGEMENT_PHASE_MIN = 2;
export const WATCHLIST_FIXED_ENGAGEMENT_PHASE_MAX = 5;

const WATCHLIST_ENGAGEMENT_PHASE_RULE_NOTE =
  "Watchlist hardcodes this filter to keep only values 2-5.";

export function isWatchlistEngagementPhaseMatch(value: number | null) {
  return (
    value !== null &&
    value >= WATCHLIST_FIXED_ENGAGEMENT_PHASE_MIN &&
    value <= WATCHLIST_FIXED_ENGAGEMENT_PHASE_MAX
  );
}

export function formatWatchlistEngagementPhaseSummary(label: string) {
  return `${label} 2-5 only`;
}

export function getWatchlistEngagementPhaseCriterionText() {
  return "Keep only values 2-5.";
}

export function appendWatchlistEngagementPhaseDefinition(definition: string) {
  const trimmedDefinition = definition.trim();

  return trimmedDefinition
    ? `${trimmedDefinition}\n\n${WATCHLIST_ENGAGEMENT_PHASE_RULE_NOTE}`
    : WATCHLIST_ENGAGEMENT_PHASE_RULE_NOTE;
}
