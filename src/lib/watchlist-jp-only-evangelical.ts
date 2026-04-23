import type { WatchlistJpOnlyEvangelicalRule } from "@/lib/api-types";

export const WATCHLIST_JP_ONLY_EVANGELICAL_LABEL =
  "Evangelical Believers (JP-only)";
export const WATCHLIST_JP_ONLY_EVANGELICAL_DEFAULT_MIN_BELIEVERS = 75;
export const WATCHLIST_JP_ONLY_EVANGELICAL_DEFAULT_MAX_BELIEVERS = 249_999;
export const WATCHLIST_JP_ONLY_EVANGELICAL_DEFAULT_MAX_PERCENT_EVANGELICAL = 2;
export const WATCHLIST_JP_ONLY_EVANGELICAL_RULE_MIN_BELIEVERS = 0;
export const WATCHLIST_JP_ONLY_EVANGELICAL_RULE_MAX_BELIEVERS = 1_000_000_000;
export const WATCHLIST_JP_ONLY_EVANGELICAL_RULE_MIN_PERCENT_EVANGELICAL = 0;
export const WATCHLIST_JP_ONLY_EVANGELICAL_RULE_MAX_PERCENT_EVANGELICAL = 100;

const WATCHLIST_JP_ONLY_EVANGELICAL_NUMBER_FORMATTER = new Intl.NumberFormat(
  "en-US",
);
const WATCHLIST_JP_ONLY_EVANGELICAL_PERCENT_FORMATTER = new Intl.NumberFormat(
  "en-US",
  {
    maximumFractionDigits: 2,
  },
);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeInteger(value: number | null | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return clamp(
    Math.round(value),
    WATCHLIST_JP_ONLY_EVANGELICAL_RULE_MIN_BELIEVERS,
    WATCHLIST_JP_ONLY_EVANGELICAL_RULE_MAX_BELIEVERS,
  );
}

function normalizePercent(value: number | null | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return clamp(
    Math.round(value * 100) / 100,
    WATCHLIST_JP_ONLY_EVANGELICAL_RULE_MIN_PERCENT_EVANGELICAL,
    WATCHLIST_JP_ONLY_EVANGELICAL_RULE_MAX_PERCENT_EVANGELICAL,
  );
}

export function getDefaultWatchlistJpOnlyEvangelicalRule(): WatchlistJpOnlyEvangelicalRule {
  return {
    minBelievers: WATCHLIST_JP_ONLY_EVANGELICAL_DEFAULT_MIN_BELIEVERS,
    maxBelievers: WATCHLIST_JP_ONLY_EVANGELICAL_DEFAULT_MAX_BELIEVERS,
    maxPercentEvangelical:
      WATCHLIST_JP_ONLY_EVANGELICAL_DEFAULT_MAX_PERCENT_EVANGELICAL,
  };
}

export function normalizeWatchlistJpOnlyEvangelicalRule(
  rule: Partial<WatchlistJpOnlyEvangelicalRule> | null | undefined,
): WatchlistJpOnlyEvangelicalRule {
  const defaultRule = getDefaultWatchlistJpOnlyEvangelicalRule();
  const minBelievers = normalizeInteger(rule?.minBelievers, defaultRule.minBelievers);
  const maxBelievers = Math.max(
    minBelievers,
    normalizeInteger(rule?.maxBelievers, defaultRule.maxBelievers),
  );

  return {
    minBelievers,
    maxBelievers,
    maxPercentEvangelical: normalizePercent(
      rule?.maxPercentEvangelical,
      defaultRule.maxPercentEvangelical,
    ),
  };
}

export function isWatchlistJpOnlyEvangelicalRuleDefault(
  rule: Partial<WatchlistJpOnlyEvangelicalRule> | null | undefined,
) {
  const normalizedRule = normalizeWatchlistJpOnlyEvangelicalRule(rule);
  const defaultRule = getDefaultWatchlistJpOnlyEvangelicalRule();

  return (
    normalizedRule.minBelievers === defaultRule.minBelievers &&
    normalizedRule.maxBelievers === defaultRule.maxBelievers &&
    normalizedRule.maxPercentEvangelical === defaultRule.maxPercentEvangelical
  );
}

function formatWatchlistJpOnlyEvangelicalBelievers(value: number) {
  return WATCHLIST_JP_ONLY_EVANGELICAL_NUMBER_FORMATTER.format(value);
}

function formatWatchlistJpOnlyEvangelicalPercent(value: number) {
  return WATCHLIST_JP_ONLY_EVANGELICAL_PERCENT_FORMATTER.format(value);
}

export function getWatchlistJpOnlyEvangelicalDefinition(
  rule?: Partial<WatchlistJpOnlyEvangelicalRule> | null,
) {
  const normalizedRule = normalizeWatchlistJpOnlyEvangelicalRule(rule);

  return `Applies only to JP-only rows (JP_Source = true; IMB_Source = false; AX_Source = false; ETNO_Source = false; WCD_Source = false) and keeps rows with under ${formatWatchlistJpOnlyEvangelicalBelievers(normalizedRule.minBelievers)} evangelical believers regardless of evangelical percent, plus rows with ${formatWatchlistJpOnlyEvangelicalBelievers(normalizedRule.minBelievers)}-${formatWatchlistJpOnlyEvangelicalBelievers(normalizedRule.maxBelievers)} evangelical believers and <= ${formatWatchlistJpOnlyEvangelicalPercent(normalizedRule.maxPercentEvangelical)}% evangelical.`;
}

export function formatWatchlistJpOnlyEvangelicalSummary(
  rule?: Partial<WatchlistJpOnlyEvangelicalRule> | null,
) {
  const normalizedRule = normalizeWatchlistJpOnlyEvangelicalRule(rule);

  return `JP-only: < ${formatWatchlistJpOnlyEvangelicalBelievers(normalizedRule.minBelievers)} believers, or ${formatWatchlistJpOnlyEvangelicalBelievers(normalizedRule.minBelievers)}-${formatWatchlistJpOnlyEvangelicalBelievers(normalizedRule.maxBelievers)} believers and <= ${formatWatchlistJpOnlyEvangelicalPercent(normalizedRule.maxPercentEvangelical)}% evangelical`;
}
