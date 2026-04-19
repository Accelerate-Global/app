import { describe, expect, it } from "vitest"

import {
  addPopulationBelieversTier,
  buildPopulationBelieversRuleSummaryLines,
  buildPopulationBelieversTierBadges,
  calculateActualBelievers,
  calculatePopulationBelieversPercent,
  createSingleTierPopulationBelieversRule,
  DEFAULT_POPULATION_BELIEVERS_RULE,
  evaluatePopulationBelieversScenario,
  getPopulationBelieversRuleTierCount,
  getPopulationBelieversTierForPopulation,
  getRequiredBelieversForPopulation,
  removePopulationBelieversTier,
  sanitizePopulationBelieversRule,
  setPopulationBelieversBreakpoint,
  setPopulationBelieversTierMinBelievers,
} from "@/lib/evangelical-population-believers-rule"

describe("evangelical-population-believers-rule", () => {
  it("calculates actual believers from population and evangelical percent", () => {
    expect(calculateActualBelievers(10_000, 0.82)).toBe(82)
    expect(calculateActualBelievers(10_000, 5)).toBe(500)
  })

  it("calculates believer percentages", () => {
    expect(calculatePopulationBelieversPercent(10_000, 82)).toBe(0.82)
    expect(calculatePopulationBelieversPercent(5_000, 50)).toBe(1)
    expect(calculatePopulationBelieversPercent(0, 50)).toBeNull()
  })

  it("looks up the required believers for each tier", () => {
    expect(getRequiredBelieversForPopulation(DEFAULT_POPULATION_BELIEVERS_RULE, 0)).toBe(50)
    expect(getRequiredBelieversForPopulation(DEFAULT_POPULATION_BELIEVERS_RULE, 4_999)).toBe(50)
    expect(getRequiredBelieversForPopulation(DEFAULT_POPULATION_BELIEVERS_RULE, 5_000)).toBe(75)
    expect(getRequiredBelieversForPopulation(DEFAULT_POPULATION_BELIEVERS_RULE, 10_000)).toBe(75)
    expect(getRequiredBelieversForPopulation(DEFAULT_POPULATION_BELIEVERS_RULE, 10_001)).toBe(100)
  })

  it("evaluates pass, near-threshold, and fail states", () => {
    expect(
      evaluatePopulationBelieversScenario({
        rule: DEFAULT_POPULATION_BELIEVERS_RULE,
        population: 10_000,
        actualBelievers: 82,
      }),
    ).toMatchObject({
      requiredBelievers: 75,
      deltaBelievers: 7,
      passes: true,
      status: "near",
    })

    expect(
      evaluatePopulationBelieversScenario({
        rule: DEFAULT_POPULATION_BELIEVERS_RULE,
        population: 10_000,
        actualBelievers: 120,
      }),
    ).toMatchObject({
      requiredBelievers: 75,
      passes: true,
      status: "pass",
    })

    expect(
      evaluatePopulationBelieversScenario({
        rule: DEFAULT_POPULATION_BELIEVERS_RULE,
        population: 10_000,
        actualBelievers: 74,
      }),
    ).toMatchObject({
      requiredBelievers: 75,
      passes: false,
      status: "fail",
    })
  })

  it("sanitizes invalid tiers into a contiguous open-ended rule", () => {
    expect(
      sanitizePopulationBelieversRule({
        tiers: [
          {
            minPopulation: 2_000,
            maxPopulation: 3_000,
            minBelievers: 120,
          },
          {
            minPopulation: -50,
            maxPopulation: 100,
            minBelievers: -5,
          },
          {
            minPopulation: 5_000,
            maxPopulation: 6_000,
            minBelievers: 250,
          },
        ],
      }),
    ).toEqual({
      tiers: [
        {
          minPopulation: 0,
          maxPopulation: 100,
          minBelievers: 0,
        },
        {
          minPopulation: 101,
          maxPopulation: 3_000,
          minBelievers: 120,
        },
        {
          minPopulation: 3_001,
          maxPopulation: null,
          minBelievers: 250,
        },
      ],
    })
  })

  it("updates breakpoints and believer floors without overlap", () => {
    const withBreakpoint = setPopulationBelieversBreakpoint(
      DEFAULT_POPULATION_BELIEVERS_RULE,
      0,
      6_200,
    )

    expect(withBreakpoint.tiers[0]).toMatchObject({
      minPopulation: 0,
      maxPopulation: 6_200,
    })
    expect(withBreakpoint.tiers[1]).toMatchObject({
      minPopulation: 6_201,
      maxPopulation: 10_000,
    })

    expect(
      setPopulationBelieversTierMinBelievers(withBreakpoint, 1, 90).tiers[1]
        ?.minBelievers,
    ).toBe(90)
  })

  it("adds and removes tiers while keeping the rule valid", () => {
    const addedRule = addPopulationBelieversTier(
      DEFAULT_POPULATION_BELIEVERS_RULE,
      1,
      7_500,
    )

    expect(getPopulationBelieversRuleTierCount(addedRule)).toBe(4)
    expect(addedRule.tiers[1]).toMatchObject({
      minPopulation: 5_000,
      maxPopulation: 7_500,
      minBelievers: 75,
    })
    expect(addedRule.tiers[2]).toMatchObject({
      minPopulation: 7_501,
      maxPopulation: 10_000,
      minBelievers: 75,
    })

    const removedRule = removePopulationBelieversTier(addedRule, 2)

    expect(removedRule).toEqual(DEFAULT_POPULATION_BELIEVERS_RULE)
  })

  it("creates a single open-ended rule from the legacy believers threshold", () => {
    expect(createSingleTierPopulationBelieversRule(125)).toEqual({
      tiers: [
        {
          minPopulation: 0,
          maxPopulation: null,
          minBelievers: 125,
        },
      ],
    })
  })

  it("builds plain-English summary lines and implied-percentage badges", () => {
    expect(
      buildPopulationBelieversRuleSummaryLines(DEFAULT_POPULATION_BELIEVERS_RULE),
    ).toEqual([
      "Under 5,000 -> at least 50 believers",
      "5,000-10,000 -> at least 75 believers",
      "Over 10,000 -> at least 100 believers",
    ])

    expect(buildPopulationBelieversTierBadges(DEFAULT_POPULATION_BELIEVERS_RULE)).toEqual([
      expect.objectContaining({
        title: "Under 5,000",
        percentLabel: "1.00%",
      }),
      expect.objectContaining({
        title: "5,000-10,000",
        percentLabel: "0.75%",
      }),
      expect.objectContaining({
        title: "Over 10,000",
        isDeclining: true,
        percentLabel: "1.00% at 10,001, declines above",
      }),
    ])
  })

  it("returns the final tier when the population exceeds all bounded tiers", () => {
    expect(
      getPopulationBelieversTierForPopulation(DEFAULT_POPULATION_BELIEVERS_RULE, 999_999),
    ).toEqual(DEFAULT_POPULATION_BELIEVERS_RULE.tiers[2])
  })
})
