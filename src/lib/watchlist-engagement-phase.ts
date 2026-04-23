import type { WatchlistEngagementPhaseRule } from "@/lib/api-types";

export const WATCHLIST_ENGAGEMENT_PHASE_RULE_MIN = 0;
export const WATCHLIST_ENGAGEMENT_PHASE_RULE_MAX = 7;
export const WATCHLIST_DEFAULT_ENGAGEMENT_PHASE_MIN = 2;
export const WATCHLIST_DEFAULT_ENGAGEMENT_PHASE_MAX = 5;
export const WATCHLIST_FIXED_ENGAGEMENT_PHASE_MIN =
  WATCHLIST_DEFAULT_ENGAGEMENT_PHASE_MIN;
export const WATCHLIST_FIXED_ENGAGEMENT_PHASE_MAX =
  WATCHLIST_DEFAULT_ENGAGEMENT_PHASE_MAX;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizePhase(value: number | null | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return clamp(
    Math.round(value),
    WATCHLIST_ENGAGEMENT_PHASE_RULE_MIN,
    WATCHLIST_ENGAGEMENT_PHASE_RULE_MAX,
  );
}

function formatWatchlistEngagementPhaseRange(
  rule?: Partial<WatchlistEngagementPhaseRule> | null,
) {
  const normalizedRule = normalizeWatchlistEngagementPhaseRule(rule);

  return normalizedRule.minPhase === normalizedRule.maxPhase
    ? `${normalizedRule.minPhase}`
    : `${normalizedRule.minPhase}-${normalizedRule.maxPhase}`;
}

function getWatchlistEngagementPhaseRuleNote(
  rule?: Partial<WatchlistEngagementPhaseRule> | null,
) {
  const range = formatWatchlistEngagementPhaseRange(rule);
  const valueLabel =
    normalizeWatchlistEngagementPhaseRule(rule).minPhase ===
    normalizeWatchlistEngagementPhaseRule(rule).maxPhase
      ? `value ${range}`
      : `values ${range}`;

  return `When enabled, Watchlist keeps only AX rows with ${valueLabel}. If AX_Source is missing or invalid, Watchlist treats the row as AX and still applies the ${range} rule.`;
}

export function getDefaultWatchlistEngagementPhaseRule(): WatchlistEngagementPhaseRule {
  return {
    minPhase: WATCHLIST_DEFAULT_ENGAGEMENT_PHASE_MIN,
    maxPhase: WATCHLIST_DEFAULT_ENGAGEMENT_PHASE_MAX,
  };
}

export function normalizeWatchlistEngagementPhaseRule(
  rule: Partial<WatchlistEngagementPhaseRule> | null | undefined,
): WatchlistEngagementPhaseRule {
  const defaultRule = getDefaultWatchlistEngagementPhaseRule();
  const minPhase = normalizePhase(rule?.minPhase, defaultRule.minPhase);
  const maxPhase = Math.max(
    minPhase,
    normalizePhase(rule?.maxPhase, defaultRule.maxPhase),
  );

  return {
    minPhase,
    maxPhase,
  };
}

export function isWatchlistEngagementPhaseRuleDefault(
  rule: Partial<WatchlistEngagementPhaseRule> | null | undefined,
) {
  const normalizedRule = normalizeWatchlistEngagementPhaseRule(rule);
  const defaultRule = getDefaultWatchlistEngagementPhaseRule();

  return (
    normalizedRule.minPhase === defaultRule.minPhase &&
    normalizedRule.maxPhase === defaultRule.maxPhase
  );
}

export function isWatchlistEngagementPhaseMatch(
  value: number | null,
  rule?: Partial<WatchlistEngagementPhaseRule> | null,
) {
  const normalizedRule = normalizeWatchlistEngagementPhaseRule(rule);

  return (
    value !== null &&
    value >= normalizedRule.minPhase &&
    value <= normalizedRule.maxPhase
  );
}

export function formatWatchlistEngagementPhaseSummary(
  label: string,
  rule?: Partial<WatchlistEngagementPhaseRule> | null,
) {
  return `${label} ${formatWatchlistEngagementPhaseRange(rule)} only`;
}

export function getWatchlistEngagementPhaseCriterionText(
  rule?: Partial<WatchlistEngagementPhaseRule> | null,
) {
  const normalizedRule = normalizeWatchlistEngagementPhaseRule(rule);
  const range = formatWatchlistEngagementPhaseRange(normalizedRule);

  return normalizedRule.minPhase === normalizedRule.maxPhase
    ? `Keep only AX rows with value ${range}.`
    : `Keep only AX rows with values ${range}.`;
}

export function appendWatchlistEngagementPhaseDefinition(
  definition: string,
  rule?: Partial<WatchlistEngagementPhaseRule> | null,
) {
  const trimmedDefinition = definition.trim();
  const note = getWatchlistEngagementPhaseRuleNote(rule);

  return trimmedDefinition ? `${trimmedDefinition}\n\n${note}` : note;
}
