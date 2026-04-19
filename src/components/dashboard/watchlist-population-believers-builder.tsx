"use client"

import {
  CrosshairIcon,
  MoveHorizontalIcon,
  MoveVerticalIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type {
  PopulationBelieversRule,
  PopulationBelieversTier,
} from "@/lib/api-types"
import {
  addPopulationBelieversTier,
  buildPopulationBelieversRuleSummaryLines,
  buildPopulationBelieversTierBadges,
  evaluatePopulationBelieversScenario,
  formatPopulationBelieversNumber,
  formatPopulationBelieversPercent,
  getPopulationBelieversRuleBelieversMax,
  getPopulationBelieversRulePopulationMax,
  POPULATION_BELIEVERS_TEST_BELIEVERS_LARGE_STEP,
  POPULATION_BELIEVERS_TEST_BELIEVERS_STEP,
  POPULATION_BELIEVERS_TEST_POPULATION_LARGE_STEP,
  POPULATION_BELIEVERS_TEST_POPULATION_STEP,
  removePopulationBelieversTier,
  sanitizePopulationBelieversRule,
  setPopulationBelieversBreakpoint,
  setPopulationBelieversTierMinBelievers,
} from "@/lib/evangelical-population-believers-rule"
import { cn } from "@/lib/utils"

type WatchlistPopulationBelieversBuilderProps = {
  disabled?: boolean
  rule: PopulationBelieversRule
  onRuleChange: (rule: PopulationBelieversRule) => void
  presentation?: "card" | "embedded"
}

type TestPoint = {
  population: number
  believers: number
}

type DragState =
  | { type: "breakpoint"; index: number }
  | { type: "tier"; index: number }
  | { type: "test-point" }

const GRAPH_WIDTH = 640
const GRAPH_HEIGHT = 360
const GRAPH_PADDING = {
  top: 24,
  right: 28,
  bottom: 54,
  left: 70,
}
const DEFAULT_TEST_POINT: TestPoint = {
  population: 8_200,
  believers: 82,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function roundGraphValue(value: number) {
  return Number.isFinite(value) ? Math.round(value) : 0
}

function getStatusAppearance(status: "fail" | "near" | "pass") {
  if (status === "fail") {
    return {
      badgeVariant: "destructive" as const,
      valueClassName: "text-destructive",
      borderClassName: "border-destructive/25",
      surfaceClassName: "bg-destructive/5",
      dotClassName: "bg-destructive ring-destructive/20",
    }
  }

  if (status === "near") {
    return {
      badgeVariant: "secondary" as const,
      valueClassName: "text-amber-700 dark:text-amber-300",
      borderClassName: "border-amber-500/25",
      surfaceClassName: "bg-amber-500/8",
      dotClassName: "bg-amber-500 ring-amber-500/20",
    }
  }

  return {
    badgeVariant: "default" as const,
    valueClassName: "text-emerald-700 dark:text-emerald-300",
    borderClassName: "border-emerald-500/25",
    surfaceClassName: "bg-emerald-500/8",
    dotClassName: "bg-emerald-500 ring-emerald-500/20",
  }
}

function getTierDisplayMax(
  tier: PopulationBelieversTier,
  nextTier: PopulationBelieversTier | undefined,
  populationMax: number,
) {
  if (nextTier) {
    return nextTier.minPopulation
  }

  if (tier.maxPopulation !== null) {
    return tier.maxPopulation
  }

  return populationMax
}

function getGraphX(population: number, populationMax: number) {
  const plotWidth = GRAPH_WIDTH - GRAPH_PADDING.left - GRAPH_PADDING.right
  return GRAPH_PADDING.left + (population / populationMax) * plotWidth
}

function getGraphY(believers: number, believersMax: number) {
  const plotHeight = GRAPH_HEIGHT - GRAPH_PADDING.top - GRAPH_PADDING.bottom
  return GRAPH_PADDING.top + plotHeight - (believers / believersMax) * plotHeight
}

function buildThresholdPath(
  tiers: PopulationBelieversTier[],
  populationMax: number,
  believersMax: number,
) {
  const pathSegments: string[] = []

  tiers.forEach((tier, index) => {
    const nextTier = tiers[index + 1]
    const startX = getGraphX(tier.minPopulation, populationMax)
    const horizontalEndX = getGraphX(
      getTierDisplayMax(tier, nextTier, populationMax),
      populationMax,
    )
    const currentY = getGraphY(tier.minBelievers, believersMax)

    if (index === 0) {
      pathSegments.push(`M ${startX} ${currentY}`)
    }

    pathSegments.push(`L ${horizontalEndX} ${currentY}`)

    if (nextTier) {
      pathSegments.push(
        `L ${horizontalEndX} ${getGraphY(nextTier.minBelievers, believersMax)}`,
      )
    }
  })

  return pathSegments.join(" ")
}

function NumericField({
  label,
  value,
  min,
  max,
  disabled,
  onValueChange,
}: {
  label: string
  value: number
  min: number
  max: number
  disabled?: boolean
  onValueChange: (value: number) => void
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      <Input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const parsedValue = Number(event.target.value)

          if (!Number.isFinite(parsedValue)) {
            return
          }

          onValueChange(clamp(roundGraphValue(parsedValue), min, max))
        }}
      />
    </label>
  )
}

export function WatchlistPopulationBelieversBuilder({
  disabled = false,
  rule,
  onRuleChange,
  presentation = "card",
}: WatchlistPopulationBelieversBuilderProps) {
  const normalizedRule = sanitizePopulationBelieversRule(rule)
  const [selectedTierIndex, setSelectedTierIndex] = useState(1)
  const [testPoint, setTestPoint] = useState<TestPoint>(DEFAULT_TEST_POINT)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const graphRef = useRef<HTMLDivElement | null>(null)
  const tiers = normalizedRule.tiers
  const safeSelectedTierIndex = Math.max(
    0,
    Math.min(selectedTierIndex, tiers.length - 1),
  )
  const selectedTier = tiers[safeSelectedTierIndex] ?? tiers[tiers.length - 1]
  const populationMax = getPopulationBelieversRulePopulationMax(
    normalizedRule,
    testPoint.population,
  )
  const believersMax = getPopulationBelieversRuleBelieversMax(
    normalizedRule,
    testPoint.believers,
  )
  const scenario = evaluatePopulationBelieversScenario({
    rule: normalizedRule,
    population: testPoint.population,
    actualBelievers: testPoint.believers,
  })
  const statusAppearance = getStatusAppearance(scenario.status)
  const thresholdPath = buildThresholdPath(tiers, populationMax, believersMax)
  const summaryLines = buildPopulationBelieversRuleSummaryLines(normalizedRule)
  const tierBadges = buildPopulationBelieversTierBadges(normalizedRule)

  useEffect(() => {
    if (!dragState) {
      return
    }

    const activeDragState = dragState

    function handlePointerMove(event: PointerEvent) {
      const graphRect = graphRef.current?.getBoundingClientRect()

      if (!graphRect || graphRect.width <= 0 || graphRect.height <= 0) {
        return
      }

      const relativeX = clamp(event.clientX - graphRect.left, 0, graphRect.width)
      const relativeY = clamp(event.clientY - graphRect.top, 0, graphRect.height)
      const normalizedX = relativeX / graphRect.width
      const normalizedY = relativeY / graphRect.height
      const nextPopulation = roundGraphValue(normalizedX * populationMax)
      const nextBelievers = roundGraphValue((1 - normalizedY) * believersMax)

      if (activeDragState.type === "breakpoint") {
        onRuleChange(
          setPopulationBelieversBreakpoint(
            normalizedRule,
            activeDragState.index,
            nextPopulation,
          ),
        )
        setSelectedTierIndex(activeDragState.index)
        return
      }

      if (activeDragState.type === "tier") {
        onRuleChange(
          setPopulationBelieversTierMinBelievers(
            normalizedRule,
            activeDragState.index,
            nextBelievers,
          ),
        )
        setSelectedTierIndex(activeDragState.index)
        return
      }

      setTestPoint({
        population: clamp(nextPopulation, 0, populationMax),
        believers: clamp(nextBelievers, 0, believersMax),
      })
    }

    function handlePointerUp() {
      setDragState(null)
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [believersMax, dragState, normalizedRule, onRuleChange, populationMax])

  const breakpointMax =
    selectedTier.maxPopulation === null
      ? populationMax - 1
      : selectedTier.maxPopulation
  const nextTier = tiers[safeSelectedTierIndex + 1]
  const selectedTierRangeLabel =
    selectedTier.maxPopulation === null
      ? `Starts at ${formatPopulationBelieversNumber(selectedTier.minPopulation)}`
      : `${formatPopulationBelieversNumber(selectedTier.minPopulation)}-${formatPopulationBelieversNumber(selectedTier.maxPopulation)}`

  const content = (
    <div className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.95fr)]">
          <div className="space-y-4">
            <div
              ref={graphRef}
              className="relative overflow-hidden rounded-2xl border border-border/70 bg-[linear-gradient(180deg,rgba(16,185,129,0.05),rgba(255,255,255,0)_42%),linear-gradient(0deg,rgba(239,68,68,0.04),rgba(255,255,255,0)_50%)]"
            >
              <svg
                viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
                className="block aspect-[1.78] w-full"
                aria-labelledby="population-believers-graph-title"
                role="img"
              >
                <title id="population-believers-graph-title">
                  Population versus evangelical believers threshold graph
                </title>
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                  const x = getGraphX(populationMax * ratio, populationMax)
                  const y = getGraphY(believersMax * ratio, believersMax)

                  return (
                    <g key={ratio}>
                      <line
                        x1={GRAPH_PADDING.left}
                        x2={GRAPH_WIDTH - GRAPH_PADDING.right}
                        y1={y}
                        y2={y}
                        className="stroke-border/70"
                        strokeDasharray="4 8"
                      />
                      <line
                        x1={x}
                        x2={x}
                        y1={GRAPH_PADDING.top}
                        y2={GRAPH_HEIGHT - GRAPH_PADDING.bottom}
                        className="stroke-border/70"
                        strokeDasharray="4 8"
                      />
                      <text
                        x={GRAPH_PADDING.left - 12}
                        y={y + 4}
                        textAnchor="end"
                        className="fill-muted-foreground text-[11px]"
                      >
                        {formatPopulationBelieversNumber(believersMax * ratio)}
                      </text>
                      <text
                        x={x}
                        y={GRAPH_HEIGHT - 20}
                        textAnchor="middle"
                        className="fill-muted-foreground text-[11px]"
                      >
                        {formatPopulationBelieversNumber(populationMax * ratio)}
                      </text>
                    </g>
                  )
                })}

                <path
                  d={thresholdPath}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-foreground"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <line
                  x1={getGraphX(testPoint.population, populationMax)}
                  x2={getGraphX(testPoint.population, populationMax)}
                  y1={getGraphY(testPoint.believers, believersMax)}
                  y2={GRAPH_HEIGHT - GRAPH_PADDING.bottom}
                  className={cn(
                    "stroke-[2]",
                    scenario.status === "fail"
                      ? "stroke-destructive/50"
                      : scenario.status === "near"
                        ? "stroke-amber-500/60"
                        : "stroke-emerald-500/55",
                  )}
                  strokeDasharray="5 7"
                />
                <line
                  x1={GRAPH_PADDING.left}
                  x2={getGraphX(testPoint.population, populationMax)}
                  y1={getGraphY(testPoint.believers, believersMax)}
                  y2={getGraphY(testPoint.believers, believersMax)}
                  className={cn(
                    "stroke-[2]",
                    scenario.status === "fail"
                      ? "stroke-destructive/50"
                      : scenario.status === "near"
                        ? "stroke-amber-500/60"
                        : "stroke-emerald-500/55",
                  )}
                  strokeDasharray="5 7"
                />

                <text
                  x={GRAPH_WIDTH / 2}
                  y={GRAPH_HEIGHT - 6}
                  textAnchor="middle"
                  className="fill-foreground text-[12px] font-medium"
                >
                  Population
                </text>
                <text
                  x={16}
                  y={GRAPH_HEIGHT / 2}
                  textAnchor="middle"
                  transform={`rotate(-90 16 ${GRAPH_HEIGHT / 2})`}
                  className="fill-foreground text-[12px] font-medium"
                >
                  Evangelical believers
                </text>
              </svg>

              <div className="pointer-events-none absolute inset-0">
                {tiers.map((tier, index) => {
                  const displayMax = getTierDisplayMax(
                    tier,
                    tiers[index + 1],
                    populationMax,
                  )
                  const centerPopulation =
                    tier.maxPopulation === null
                      ? (tier.minPopulation + populationMax) / 2
                      : (tier.minPopulation + displayMax) / 2
                  const tierLeft = `${(getGraphX(centerPopulation, populationMax) / GRAPH_WIDTH) * 100}%`
                  const tierTop = `${(getGraphY(tier.minBelievers, believersMax) / GRAPH_HEIGHT) * 100}%`

                  return (
                    <button
                      key={`${tier.minPopulation}-${tier.maxPopulation ?? "open"}-handle`}
                      type="button"
                      aria-label={`Adjust minimum believers for ${tierBadges[index]?.title ?? "selected tier"}`}
                      disabled={disabled}
                      className={cn(
                        "pointer-events-auto absolute z-10 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-background bg-card text-foreground shadow-lg ring-4 ring-background/90 transition",
                        safeSelectedTierIndex === index
                          ? "scale-105 border-foreground/20"
                          : "hover:scale-105 hover:border-foreground/20",
                        disabled && "cursor-not-allowed opacity-60",
                      )}
                      style={{ left: tierLeft, top: tierTop }}
                      onClick={() => setSelectedTierIndex(index)}
                      onPointerDown={(event) => {
                        if (disabled) {
                          return
                        }

                        event.preventDefault()
                        setSelectedTierIndex(index)
                        setDragState({ type: "tier", index })
                      }}
                      onKeyDown={(event) => {
                        if (disabled) {
                          return
                        }

                        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
                          return
                        }

                        event.preventDefault()
                        onRuleChange(
                          setPopulationBelieversTierMinBelievers(
                            normalizedRule,
                            index,
                            tier.minBelievers +
                              (event.key === "ArrowUp" ? 1 : -1) *
                                (event.shiftKey
                                  ? POPULATION_BELIEVERS_TEST_BELIEVERS_LARGE_STEP
                                  : POPULATION_BELIEVERS_TEST_BELIEVERS_STEP),
                          ),
                        )
                        setSelectedTierIndex(index)
                      }}
                    >
                      <MoveVerticalIcon className="size-4" />
                    </button>
                  )
                })}

                {tiers.slice(0, -1).map((tier, index) => {
                  const nextTierForBreakpoint = tiers[index + 1]
                  const breakpointPopulation = nextTierForBreakpoint.minPopulation
                  const breakpointLeft = `${(getGraphX(breakpointPopulation, populationMax) / GRAPH_WIDTH) * 100}%`
                  const breakpointTop = `${(((getGraphY(tier.minBelievers, believersMax) + getGraphY(nextTierForBreakpoint.minBelievers, believersMax)) / 2) / GRAPH_HEIGHT) * 100}%`

                  return (
                    <button
                      key={`${tier.minPopulation}-${breakpointPopulation}-breakpoint`}
                      type="button"
                      aria-label={`Adjust population breakpoint after ${formatPopulationBelieversNumber(tier.minPopulation)}`}
                      disabled={disabled}
                      className={cn(
                        "pointer-events-auto absolute z-20 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-background bg-background text-foreground shadow-lg ring-4 ring-background/90 transition",
                        safeSelectedTierIndex === index
                          ? "scale-105 border-foreground/20"
                          : "hover:scale-105 hover:border-foreground/20",
                        disabled && "cursor-not-allowed opacity-60",
                      )}
                      style={{ left: breakpointLeft, top: breakpointTop }}
                      onClick={() => setSelectedTierIndex(index)}
                      onPointerDown={(event) => {
                        if (disabled) {
                          return
                        }

                        event.preventDefault()
                        setSelectedTierIndex(index)
                        setDragState({ type: "breakpoint", index })
                      }}
                      onKeyDown={(event) => {
                        if (disabled) {
                          return
                        }

                        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
                          return
                        }

                        event.preventDefault()
                        onRuleChange(
                          setPopulationBelieversBreakpoint(
                            normalizedRule,
                            index,
                            breakpointPopulation +
                              (event.key === "ArrowRight" ? 1 : -1) *
                                (event.shiftKey
                                  ? POPULATION_BELIEVERS_TEST_POPULATION_LARGE_STEP
                                  : POPULATION_BELIEVERS_TEST_POPULATION_STEP),
                          ),
                        )
                        setSelectedTierIndex(index)
                      }}
                    >
                      <MoveHorizontalIcon className="size-4" />
                    </button>
                  )
                })}

                <button
                  type="button"
                  aria-label="Adjust test scenario"
                  disabled={disabled}
                  className={cn(
                    "pointer-events-auto absolute z-30 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-background shadow-xl ring-8 ring-background/80 transition",
                    statusAppearance.dotClassName,
                    disabled && "cursor-not-allowed opacity-70",
                  )}
                  style={{
                    left: `${(getGraphX(testPoint.population, populationMax) / GRAPH_WIDTH) * 100}%`,
                    top: `${(getGraphY(testPoint.believers, believersMax) / GRAPH_HEIGHT) * 100}%`,
                  }}
                  onPointerDown={(event) => {
                    if (disabled) {
                      return
                    }

                    event.preventDefault()
                    setDragState({ type: "test-point" })
                  }}
                  onKeyDown={(event) => {
                    if (disabled) {
                      return
                    }

                    const populationStep = event.shiftKey
                      ? POPULATION_BELIEVERS_TEST_POPULATION_LARGE_STEP
                      : POPULATION_BELIEVERS_TEST_POPULATION_STEP
                    const believersStep = event.shiftKey
                      ? POPULATION_BELIEVERS_TEST_BELIEVERS_LARGE_STEP
                      : POPULATION_BELIEVERS_TEST_BELIEVERS_STEP

                    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                      event.preventDefault()
                      setTestPoint((current) => ({
                        ...current,
                        population: clamp(
                          current.population +
                            (event.key === "ArrowRight" ? populationStep : -populationStep),
                          0,
                          populationMax,
                        ),
                      }))
                    }

                    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                      event.preventDefault()
                      setTestPoint((current) => ({
                        ...current,
                        believers: clamp(
                          current.believers +
                            (event.key === "ArrowUp" ? believersStep : -believersStep),
                          0,
                          believersMax,
                        ),
                      }))
                    }
                  }}
                >
                  <CrosshairIcon className="size-4 text-white" />
                </button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              {tierBadges.map((badge, index) => (
                <button
                  key={badge.id}
                  type="button"
                  disabled={disabled}
                  className={cn(
                    "rounded-2xl border border-border/70 bg-card px-4 py-3 text-left transition",
                    safeSelectedTierIndex === index
                      ? "border-foreground/20 shadow-sm"
                      : "hover:border-foreground/20 hover:bg-accent/10",
                    disabled && "cursor-not-allowed opacity-70",
                  )}
                  onClick={() => setSelectedTierIndex(index)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold tracking-[-0.02em] text-foreground">
                        {badge.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {badge.populationLabel}
                      </p>
                    </div>
                    <Badge variant={badge.isDeclining ? "outline" : "secondary"}>
                      {badge.percentLabel}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-foreground">{badge.believersLabel}</p>
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/25 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Rule summary
              </p>
              <div className="mt-2 space-y-1.5 text-sm text-foreground">
                {summaryLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div
              className={cn(
                "rounded-2xl border px-4 py-4",
                statusAppearance.borderClassName,
                statusAppearance.surfaceClassName,
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Scenario result
                  </p>
                  <p className={cn("mt-2 text-3xl font-semibold tracking-[-0.04em]", statusAppearance.valueClassName)}>
                    {formatPopulationBelieversPercent(scenario.actualPercent)}
                  </p>
                </div>
                <Badge variant={statusAppearance.badgeVariant}>
                  {scenario.passes ? "Pass" : "Fail"}
                </Badge>
              </div>

              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-background/75 px-3 py-2.5">
                  <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
                    Actual
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {formatPopulationBelieversNumber(testPoint.population)} population
                  </p>
                  <p className="text-muted-foreground">
                    {formatPopulationBelieversNumber(testPoint.believers)} believers
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/75 px-3 py-2.5">
                  <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
                    Required
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {formatPopulationBelieversNumber(scenario.requiredBelievers)} believers
                  </p>
                  <p className="text-muted-foreground">
                    {formatPopulationBelieversPercent(scenario.requiredPercent)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/75 px-3 py-2.5">
                  <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
                    Difference
                  </p>
                  <p
                    className={cn(
                      "mt-1 font-medium",
                      scenario.deltaBelievers < 0
                        ? "text-destructive"
                        : scenario.status === "near"
                          ? "text-amber-700 dark:text-amber-300"
                          : "text-emerald-700 dark:text-emerald-300",
                    )}
                  >
                    {scenario.deltaBelievers >= 0 ? "+" : ""}
                    {formatPopulationBelieversNumber(scenario.deltaBelievers)}
                  </p>
                  <p className="text-muted-foreground">
                    relative to the threshold
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/75 px-3 py-2.5">
                  <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
                    Active tier
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {tierBadges.find(
                      (badge) =>
                        badge.id ===
                        `${scenario.tier.minPopulation}-${scenario.tier.maxPopulation ?? "open"}`,
                    )?.title ?? "Current tier"}
                  </p>
                  <p className="text-muted-foreground">
                    {formatPopulationBelieversNumber(scenario.tier.minBelievers)} minimum believers
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Selected tier
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {tierBadges[safeSelectedTierIndex]?.title ?? "Tier"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedTierRangeLabel}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled || tiers.length >= 6}
                    onClick={() =>
                      onRuleChange(
                        addPopulationBelieversTier(
                          normalizedRule,
                          safeSelectedTierIndex,
                          selectedTier.maxPopulation === null
                            ? Math.floor((selectedTier.minPopulation + populationMax) / 2)
                            : Math.floor(
                                (selectedTier.minPopulation +
                                  selectedTier.maxPopulation) /
                                  2,
                              ),
                        ),
                      )
                    }
                  >
                    <PlusIcon className="size-3.5" />
                    Add tier
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled || tiers.length <= 1}
                    onClick={() => {
                      const nextRule = removePopulationBelieversTier(
                        normalizedRule,
                        safeSelectedTierIndex,
                      )
                      onRuleChange(nextRule)
                      setSelectedTierIndex(
                        Math.max(
                          0,
                          Math.min(safeSelectedTierIndex, nextRule.tiers.length - 1),
                        ),
                      )
                    }}
                  >
                    <Trash2Icon className="size-3.5" />
                    Remove tier
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <NumericField
                  label="Tier starts"
                  value={selectedTier.minPopulation}
                  min={selectedTier.minPopulation}
                  max={selectedTier.minPopulation}
                  disabled
                  onValueChange={() => {}}
                />
                {selectedTier.maxPopulation === null ? (
                  <div className="rounded-xl border border-dashed border-border/70 px-3 py-2.5">
                    <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                      Range end
                    </p>
                    <p className="mt-2 text-sm text-foreground">
                      Open-ended above {formatPopulationBelieversNumber(selectedTier.minPopulation)}
                    </p>
                  </div>
                ) : (
                  <NumericField
                    label="Tier ends"
                    value={selectedTier.maxPopulation}
                    min={selectedTier.minPopulation}
                    max={
                      nextTier?.maxPopulation === null
                        ? populationMax - 1
                        : (nextTier?.maxPopulation ?? breakpointMax + 1) - 1
                    }
                    disabled={disabled}
                    onValueChange={(value) =>
                      onRuleChange(
                        setPopulationBelieversBreakpoint(
                          normalizedRule,
                          safeSelectedTierIndex,
                          value,
                        ),
                      )
                    }
                  />
                )}

                <NumericField
                  label="Minimum believers"
                  value={selectedTier.minBelievers}
                  min={0}
                  max={believersMax * 4}
                  disabled={disabled}
                  onValueChange={(value) =>
                    onRuleChange(
                      setPopulationBelieversTierMinBelievers(
                        normalizedRule,
                        safeSelectedTierIndex,
                        value,
                      ),
                    )
                  }
                />
                <div className="rounded-xl border border-dashed border-border/70 px-3 py-2.5">
                  <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
                    Implied percentage
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    {tierBadges[safeSelectedTierIndex]?.percentLabel ?? "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Test scenario
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <NumericField
                  label="Population"
                  value={testPoint.population}
                  min={0}
                  max={populationMax}
                  disabled={disabled}
                  onValueChange={(value) =>
                    setTestPoint((current) => ({ ...current, population: value }))
                  }
                />
                <NumericField
                  label="Believers"
                  value={testPoint.believers}
                  min={0}
                  max={believersMax}
                  disabled={disabled}
                  onValueChange={(value) =>
                    setTestPoint((current) => ({ ...current, believers: value }))
                  }
                />
              </div>
            </div>
          </div>
        </div>
    </div>
  )

  if (presentation === "embedded") {
    return <div className={cn(disabled && "opacity-75")}>{content}</div>
  }

  return (
    <Card
      size="sm"
      className={cn(
        "overflow-visible border border-border/80 shadow-xs",
        disabled && "opacity-75",
      )}
    >
      <CardHeader className="gap-2 border-b border-border/70">
        <CardTitle className="text-sm">Visual threshold builder</CardTitle>
        <CardDescription className="max-w-2xl leading-6">
          Drag the breakpoint handles to shift population cutoffs, drag the tier
          floor handles to set the minimum believers for each range, and move the
          test dot to evaluate a scenario in real time.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">{content}</CardContent>
    </Card>
  )
}
