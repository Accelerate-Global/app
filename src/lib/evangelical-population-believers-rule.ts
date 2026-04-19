import type {
  PopulationBelieversRule,
  PopulationBelieversTier,
} from "@/lib/api-types"

export const POPULATION_BELIEVERS_RULE_MIN_TIERS = 1
export const POPULATION_BELIEVERS_RULE_MAX_TIERS = 6
export const POPULATION_BELIEVERS_TEST_POPULATION_STEP = 100
export const POPULATION_BELIEVERS_TEST_POPULATION_LARGE_STEP = 1000
export const POPULATION_BELIEVERS_TEST_BELIEVERS_STEP = 5
export const POPULATION_BELIEVERS_TEST_BELIEVERS_LARGE_STEP = 25

export const DEFAULT_POPULATION_BELIEVERS_RULE = {
  tiers: [
    {
      minPopulation: 0,
      maxPopulation: 4_999,
      minBelievers: 50,
    },
    {
      minPopulation: 5_000,
      maxPopulation: 10_000,
      minBelievers: 75,
    },
    {
      minPopulation: 10_001,
      maxPopulation: null,
      minBelievers: 100,
    },
  ],
} as const satisfies PopulationBelieversRule

export type PopulationBelieversEvaluation = {
  actualBelievers: number
  actualPercent: number | null
  requiredBelievers: number
  requiredPercent: number | null
  deltaBelievers: number
  passes: boolean
  status: "fail" | "near" | "pass"
  tier: PopulationBelieversTier
}

export type PopulationBelieversTierBadge = {
  id: string
  title: string
  believersLabel: string
  populationLabel: string
  percentLabel: string
  isDeclining: boolean
}

function roundToInt(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Math.round(value)
}

function normalizePopulation(value: number, fallback = 0) {
  return Math.max(0, roundToInt(value, fallback))
}

function normalizeBelievers(value: number, fallback = 0) {
  return Math.max(0, roundToInt(value, fallback))
}

function roundMetric(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000
}

function cloneTier(tier: PopulationBelieversTier): PopulationBelieversTier {
  return {
    minPopulation: tier.minPopulation,
    maxPopulation: tier.maxPopulation,
    minBelievers: tier.minBelievers,
  }
}

export function createDefaultPopulationBelieversRule(): PopulationBelieversRule {
  return {
    tiers: DEFAULT_POPULATION_BELIEVERS_RULE.tiers.map((tier) => ({
      minPopulation: tier.minPopulation,
      maxPopulation: tier.maxPopulation,
      minBelievers: tier.minBelievers,
    })),
  }
}

export function createSingleTierPopulationBelieversRule(minBelievers: number) {
  return sanitizePopulationBelieversRule({
    tiers: [
      {
        minPopulation: 0,
        maxPopulation: null,
        minBelievers: normalizeBelievers(minBelievers),
      },
    ],
  })
}

export function sanitizePopulationBelieversRule(
  rule: PopulationBelieversRule | null | undefined,
): PopulationBelieversRule {
  const fallbackRule = createDefaultPopulationBelieversRule()
  const sourceTiers =
    rule?.tiers && rule.tiers.length > 0 ? rule.tiers : fallbackRule.tiers

  const normalizedSourceTiers = sourceTiers
    .slice(0, POPULATION_BELIEVERS_RULE_MAX_TIERS)
    .map((tier) => ({
      minPopulation: normalizePopulation(tier.minPopulation),
      maxPopulation:
        tier.maxPopulation === null ? null : normalizePopulation(tier.maxPopulation),
      minBelievers: normalizeBelievers(tier.minBelievers),
    }))
    .sort((left, right) => left.minPopulation - right.minPopulation)

  const normalizedTiers: PopulationBelieversTier[] = []
  let nextMinPopulation = 0

  for (let index = 0; index < normalizedSourceTiers.length; index += 1) {
    const sourceTier = normalizedSourceTiers[index]
    const isLastTier = index === normalizedSourceTiers.length - 1
    const minBelievers = normalizeBelievers(sourceTier.minBelievers)

    if (isLastTier) {
      normalizedTiers.push({
        minPopulation: nextMinPopulation,
        maxPopulation: null,
        minBelievers,
      })
      break
    }

    const maxPopulation = Math.max(
      nextMinPopulation,
      sourceTier.maxPopulation ?? nextMinPopulation,
    )

    normalizedTiers.push({
      minPopulation: nextMinPopulation,
      maxPopulation,
      minBelievers,
    })
    nextMinPopulation = maxPopulation + 1
  }

  if (normalizedTiers.length === 0) {
    return fallbackRule
  }

  const cappedTiers =
    normalizedTiers.length > POPULATION_BELIEVERS_RULE_MAX_TIERS
      ? normalizedTiers.slice(0, POPULATION_BELIEVERS_RULE_MAX_TIERS)
      : normalizedTiers

  return {
    tiers: cappedTiers.map((tier, index) => ({
      ...tier,
      minPopulation: index === 0 ? 0 : tier.minPopulation,
      maxPopulation: index === cappedTiers.length - 1 ? null : tier.maxPopulation,
      minBelievers: normalizeBelievers(tier.minBelievers),
    })),
  }
}

export function getPopulationBelieversRuleTierCount(
  rule: PopulationBelieversRule | null | undefined,
) {
  return sanitizePopulationBelieversRule(rule).tiers.length
}

export function getPopulationBelieversTierForPopulation(
  rule: PopulationBelieversRule | null | undefined,
  population: number,
) {
  const normalizedRule = sanitizePopulationBelieversRule(rule)
  const normalizedPopulation = normalizePopulation(population)

  return (
    normalizedRule.tiers.find((tier) => {
      if (tier.maxPopulation === null) {
        return normalizedPopulation >= tier.minPopulation
      }

      return (
        normalizedPopulation >= tier.minPopulation &&
        normalizedPopulation <= tier.maxPopulation
      )
    }) ?? normalizedRule.tiers[normalizedRule.tiers.length - 1]
  )
}

export function getRequiredBelieversForPopulation(
  rule: PopulationBelieversRule | null | undefined,
  population: number,
) {
  return getPopulationBelieversTierForPopulation(rule, population).minBelievers
}

export function calculateActualBelievers(
  population: number,
  percentEvangelical: number,
) {
  if (!Number.isFinite(population) || !Number.isFinite(percentEvangelical)) {
    return null
  }

  return roundMetric(population * (percentEvangelical / 100))
}

export function calculatePopulationBelieversPercent(
  population: number,
  believers: number,
) {
  if (!Number.isFinite(population) || !Number.isFinite(believers) || population <= 0) {
    return null
  }

  return roundMetric((believers / population) * 100)
}

export function getPopulationBelieversNearThresholdMargin(requiredBelievers: number) {
  return Math.max(5, Math.ceil(requiredBelievers * 0.1))
}

export function evaluatePopulationBelieversScenario(input: {
  rule: PopulationBelieversRule | null | undefined
  population: number
  actualBelievers: number
}): PopulationBelieversEvaluation {
  const normalizedPopulation = normalizePopulation(input.population)
  const actualBelievers = Math.max(0, input.actualBelievers)
  const tier = getPopulationBelieversTierForPopulation(input.rule, normalizedPopulation)
  const requiredBelievers = tier.minBelievers
  const deltaBelievers = actualBelievers - requiredBelievers
  const passes = deltaBelievers >= 0
  const actualPercent = calculatePopulationBelieversPercent(
    normalizedPopulation,
    actualBelievers,
  )
  const requiredPercent = calculatePopulationBelieversPercent(
    normalizedPopulation,
    requiredBelievers,
  )
  const nearThresholdMargin =
    getPopulationBelieversNearThresholdMargin(requiredBelievers)
  const status = !passes ? "fail" : deltaBelievers <= nearThresholdMargin ? "near" : "pass"

  return {
    actualBelievers,
    actualPercent,
    requiredBelievers,
    requiredPercent,
    deltaBelievers,
    passes,
    status,
    tier,
  }
}

export function setPopulationBelieversBreakpoint(
  rule: PopulationBelieversRule | null | undefined,
  breakpointIndex: number,
  nextMaxPopulation: number,
) {
  const normalizedRule = sanitizePopulationBelieversRule(rule)

  if (
    breakpointIndex < 0 ||
    breakpointIndex >= normalizedRule.tiers.length - 1
  ) {
    return normalizedRule
  }

  const nextTiers = normalizedRule.tiers.map(cloneTier)
  const currentTier = nextTiers[breakpointIndex]
  const followingTier = nextTiers[breakpointIndex + 1]
  const maxAllowed =
    followingTier.maxPopulation === null
      ? Number.MAX_SAFE_INTEGER
      : followingTier.maxPopulation - 1
  const normalizedMaxPopulation = Math.min(
    maxAllowed,
    Math.max(currentTier.minPopulation, normalizePopulation(nextMaxPopulation)),
  )

  nextTiers[breakpointIndex] = {
    ...currentTier,
    maxPopulation: normalizedMaxPopulation,
  }
  nextTiers[breakpointIndex + 1] = {
    ...followingTier,
    minPopulation: normalizedMaxPopulation + 1,
  }

  return sanitizePopulationBelieversRule({ tiers: nextTiers })
}

export function setPopulationBelieversTierMinBelievers(
  rule: PopulationBelieversRule | null | undefined,
  tierIndex: number,
  nextMinBelievers: number,
) {
  const normalizedRule = sanitizePopulationBelieversRule(rule)

  if (tierIndex < 0 || tierIndex >= normalizedRule.tiers.length) {
    return normalizedRule
  }

  const nextTiers = normalizedRule.tiers.map(cloneTier)
  nextTiers[tierIndex] = {
    ...nextTiers[tierIndex],
    minBelievers: normalizeBelievers(nextMinBelievers),
  }

  return sanitizePopulationBelieversRule({ tiers: nextTiers })
}

export function addPopulationBelieversTier(
  rule: PopulationBelieversRule | null | undefined,
  tierIndex: number,
  splitPopulation?: number,
) {
  const normalizedRule = sanitizePopulationBelieversRule(rule)

  if (normalizedRule.tiers.length >= POPULATION_BELIEVERS_RULE_MAX_TIERS) {
    return normalizedRule
  }

  const targetTier = normalizedRule.tiers[tierIndex]

  if (!targetTier) {
    return normalizedRule
  }

  const tierUpperBound =
    targetTier.maxPopulation ?? Math.max(targetTier.minPopulation + 5_000, 20_000)
  const midpointPopulation =
    splitPopulation === undefined
      ? Math.floor((targetTier.minPopulation + tierUpperBound) / 2)
      : normalizePopulation(splitPopulation)
  const boundedMidpoint = Math.min(
    tierUpperBound - 1,
    Math.max(targetTier.minPopulation, midpointPopulation),
  )

  const nextTiers = normalizedRule.tiers.map(cloneTier)
  const insertedTier: PopulationBelieversTier = {
    minPopulation: boundedMidpoint + 1,
    maxPopulation: targetTier.maxPopulation,
    minBelievers: targetTier.minBelievers,
  }

  nextTiers[tierIndex] = {
    ...targetTier,
    maxPopulation: boundedMidpoint,
  }
  nextTiers.splice(tierIndex + 1, 0, insertedTier)

  return sanitizePopulationBelieversRule({ tiers: nextTiers })
}

export function removePopulationBelieversTier(
  rule: PopulationBelieversRule | null | undefined,
  tierIndex: number,
) {
  const normalizedRule = sanitizePopulationBelieversRule(rule)

  if (
    normalizedRule.tiers.length <= POPULATION_BELIEVERS_RULE_MIN_TIERS ||
    tierIndex < 0 ||
    tierIndex >= normalizedRule.tiers.length
  ) {
    return normalizedRule
  }

  const nextTiers = normalizedRule.tiers.map(cloneTier)

  if (tierIndex === 0) {
    const [, ...rest] = nextTiers

    if (rest[0]) {
      rest[0] = {
        ...rest[0],
        minPopulation: 0,
      }
    }

    return sanitizePopulationBelieversRule({ tiers: rest })
  }

  const removedTier = nextTiers[tierIndex]
  const previousTier = nextTiers[tierIndex - 1]

  nextTiers[tierIndex - 1] = {
    ...previousTier,
    maxPopulation: removedTier.maxPopulation,
  }
  nextTiers.splice(tierIndex, 1)

  return sanitizePopulationBelieversRule({ tiers: nextTiers })
}

export function formatPopulationBelieversNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value))
}

export function formatPopulationBelieversPercent(
  percent: number | null | undefined,
) {
  if (percent === null || percent === undefined || !Number.isFinite(percent)) {
    return "—"
  }

  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(percent)}%`
}

export function formatPopulationBelieversTierTitle(tier: PopulationBelieversTier) {
  if (tier.minPopulation === 0 && tier.maxPopulation === null) {
    return "Any population"
  }

  if (tier.minPopulation === 0 && tier.maxPopulation !== null) {
    return `Under ${formatPopulationBelieversNumber(tier.maxPopulation + 1)}`
  }

  if (tier.maxPopulation === null) {
    return `Over ${formatPopulationBelieversNumber(tier.minPopulation - 1)}`
  }

  return `${formatPopulationBelieversNumber(tier.minPopulation)}-${formatPopulationBelieversNumber(tier.maxPopulation)}`
}

export function buildPopulationBelieversRuleSummaryLines(
  rule: PopulationBelieversRule | null | undefined,
) {
  return sanitizePopulationBelieversRule(rule).tiers.map((tier) => {
    return `${formatPopulationBelieversTierTitle(tier)} -> at least ${formatPopulationBelieversNumber(tier.minBelievers)} believers`
  })
}

function getTierBoundaryPopulation(tier: PopulationBelieversTier) {
  if (tier.maxPopulation === null) {
    return tier.minPopulation
  }

  if (tier.minPopulation === 0) {
    return tier.maxPopulation + 1
  }

  return tier.maxPopulation
}

export function buildPopulationBelieversTierBadges(
  rule: PopulationBelieversRule | null | undefined,
): PopulationBelieversTierBadge[] {
  return sanitizePopulationBelieversRule(rule).tiers.map((tier) => {
    const boundaryPopulation = getTierBoundaryPopulation(tier)
    const impliedPercent = calculatePopulationBelieversPercent(
      boundaryPopulation,
      tier.minBelievers,
    )
    const title = formatPopulationBelieversTierTitle(tier)

    return {
      id: `${tier.minPopulation}-${tier.maxPopulation ?? "open"}`,
      title,
      believersLabel: `${formatPopulationBelieversNumber(tier.minBelievers)} believers`,
      populationLabel:
        tier.maxPopulation === null
          ? `at ${formatPopulationBelieversNumber(boundaryPopulation)} and above`
          : `at ${formatPopulationBelieversNumber(boundaryPopulation)}`,
      percentLabel:
        tier.maxPopulation === null
          ? `${formatPopulationBelieversPercent(impliedPercent)} at ${formatPopulationBelieversNumber(boundaryPopulation)}, declines above`
          : formatPopulationBelieversPercent(impliedPercent),
      isDeclining: tier.maxPopulation === null,
    }
  })
}

export function getPopulationBelieversRulePopulationMax(
  rule: PopulationBelieversRule | null | undefined,
  testPopulation = 0,
) {
  const normalizedRule = sanitizePopulationBelieversRule(rule)
  const lastTier = normalizedRule.tiers[normalizedRule.tiers.length - 1]
  const highestBoundedPopulation = normalizedRule.tiers.reduce((highest, tier) => {
    if (tier.maxPopulation === null) {
      return highest
    }

    return Math.max(highest, tier.maxPopulation)
  }, 0)
  const targetPopulation = Math.max(
    testPopulation,
    highestBoundedPopulation,
    Math.max(lastTier.minPopulation * 2, 20_000),
  )
  const roundingStep =
    targetPopulation <= 10_000 ? 1_000 : targetPopulation <= 50_000 ? 5_000 : 10_000

  return Math.ceil(targetPopulation / roundingStep) * roundingStep
}

export function getPopulationBelieversRuleBelieversMax(
  rule: PopulationBelieversRule | null | undefined,
  testBelievers = 0,
) {
  const normalizedRule = sanitizePopulationBelieversRule(rule)
  const highestBelievers = normalizedRule.tiers.reduce(
    (highest, tier) => Math.max(highest, tier.minBelievers),
    0,
  )
  const targetBelievers = Math.max(testBelievers, highestBelievers, 100)
  const roundingStep =
    targetBelievers <= 250 ? 25 : targetBelievers <= 1_000 ? 100 : 250

  return Math.ceil(targetBelievers / roundingStep) * roundingStep
}
