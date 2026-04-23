import { describe, expect, it } from "vitest";

import {
  formatWatchlistJpOnlyEvangelicalSummary,
  getDefaultWatchlistJpOnlyEvangelicalRule,
  getWatchlistJpOnlyEvangelicalDefinition,
  isWatchlistJpOnlyEvangelicalRuleDefault,
  normalizeWatchlistJpOnlyEvangelicalRule,
} from "./watchlist-jp-only-evangelical";

describe("watchlist-jp-only-evangelical", () => {
  it("returns the shipped default JP-only rule", () => {
    expect(getDefaultWatchlistJpOnlyEvangelicalRule()).toEqual({
      minBelievers: 75,
      maxBelievers: 249_999,
      maxPercentEvangelical: 2,
    });
  });

  it("normalizes invalid JP-only rule values back into a safe range", () => {
    expect(
      normalizeWatchlistJpOnlyEvangelicalRule({
        minBelievers: 90.4,
        maxBelievers: 80,
        maxPercentEvangelical: 120,
      }),
    ).toEqual({
      minBelievers: 90,
      maxBelievers: 90,
      maxPercentEvangelical: 100,
    });
  });

  it("formats summaries and definitions from the configured rule", () => {
    const rule = {
      minBelievers: 90,
      maxBelievers: 300_000,
      maxPercentEvangelical: 2.5,
    };

    expect(formatWatchlistJpOnlyEvangelicalSummary(rule)).toBe(
      "JP-only: < 90 believers, or 90-300,000 believers and <= 2.5% evangelical",
    );
    expect(getWatchlistJpOnlyEvangelicalDefinition(rule)).toContain(
      "under 90 evangelical believers",
    );
    expect(getWatchlistJpOnlyEvangelicalDefinition(rule)).toContain(
      "90-300,000 evangelical believers and <= 2.5% evangelical",
    );
  });

  it("detects whether a rule still matches the defaults", () => {
    expect(
      isWatchlistJpOnlyEvangelicalRuleDefault(
        getDefaultWatchlistJpOnlyEvangelicalRule(),
      ),
    ).toBe(true);
    expect(
      isWatchlistJpOnlyEvangelicalRuleDefault({
        minBelievers: 80,
        maxBelievers: 249_999,
        maxPercentEvangelical: 2,
      }),
    ).toBe(false);
  });
});
