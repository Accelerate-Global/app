// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

import type { PopulationBelieversRule } from "@/lib/api-types"
import { DEFAULT_POPULATION_BELIEVERS_RULE } from "@/lib/evangelical-population-believers-rule"

import { WatchlistPopulationBelieversBuilder } from "./watchlist-population-believers-builder"

function TestHarness({
  onRuleChange,
}: {
  onRuleChange?: (rule: PopulationBelieversRule) => void
}) {
  const [rule, setRule] = useState<PopulationBelieversRule>(
    DEFAULT_POPULATION_BELIEVERS_RULE,
  )

  return (
    <WatchlistPopulationBelieversBuilder
      rule={rule}
      onRuleChange={(nextRule) => {
        setRule(nextRule)
        onRuleChange?.(nextRule)
      }}
    />
  )
}

describe("WatchlistPopulationBelieversBuilder", () => {
  it("renders the tier summary and scenario panel", () => {
    render(<TestHarness />)

    expect(screen.getByText("Visual threshold builder")).toBeTruthy()
    expect(screen.getByText("Scenario result")).toBeTruthy()
    expect(screen.getByText("Rule summary")).toBeTruthy()
    expect(screen.getByText("Under 5,000 -> at least 50 believers")).toBeTruthy()
    expect(screen.getByText("Over 10,000 -> at least 100 believers")).toBeTruthy()
  })

  it("supports keyboard adjustments for the test dot", () => {
    render(<TestHarness />)

    const scenarioButton = screen.getByRole("button", {
      name: "Adjust test scenario",
    })

    expect(screen.getByText("8,200 population")).toBeTruthy()
    expect(screen.getByText("82 believers")).toBeTruthy()

    fireEvent.keyDown(scenarioButton, { key: "ArrowRight" })
    fireEvent.keyDown(scenarioButton, { key: "ArrowUp", shiftKey: true })

    expect(screen.getByText("8,300 population")).toBeTruthy()
    expect(screen.getByDisplayValue("100")).toBeTruthy()
  })

  it("updates the breakpoint rule when a breakpoint handle is dragged", () => {
    const onRuleChange = vi.fn()
    render(<TestHarness onRuleChange={onRuleChange} />)

    const graph = screen
      .getByRole("img", {
        name: "Population versus evangelical believers threshold graph",
      })
      .parentElement

    if (!graph) {
      throw new Error("Expected graph container to render")
    }

    vi.spyOn(graph, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 640,
      bottom: 360,
      width: 640,
      height: 360,
      toJSON: () => ({}),
    })

    const breakpointHandle = screen.getByRole("button", {
      name: "Adjust population breakpoint after 0",
    })

    fireEvent.pointerDown(breakpointHandle, { clientX: 128, clientY: 120 })
    fireEvent.pointerMove(window, { clientX: 200, clientY: 120 })
    fireEvent.pointerUp(window)

    const latestRule = onRuleChange.mock.lastCall?.[0] as PopulationBelieversRule

    expect(latestRule.tiers[0]?.maxPopulation).not.toBe(4_999)
    expect(latestRule.tiers[1]?.minPopulation).toBe(
      (latestRule.tiers[0]?.maxPopulation ?? 0) + 1,
    )
  })
})
