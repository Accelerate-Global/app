# Watchlist Population vs Evangelical Believers Rule

## Purpose

The dataset-detail Watchlist filter now uses a tiered population-to-believers rule instead of separate flat evangelical believers and evangelical percent controls.

The goal is to let users understand and adjust the rule visually:

- the graph is the main control surface
- the threshold line shows the configured stepped minimum believers rule
- the draggable test dot shows a hypothetical or real group against that rule
- the derived percentage stays visible without making percentage a second filter users must manage

## Where It Lives

- UI entry point: `/dashboard/datasets/[datasetId]`
- Watchlist UI integration: `src/components/dashboard/dataset-view-switch-grid.tsx`
- Compact Watchlist row plus popup editor: `src/components/dashboard/dataset-view-switch-grid.tsx`
- Interactive graph component: `src/components/dashboard/watchlist-population-believers-builder.tsx`
- Rule engine and summary helpers: `src/lib/evangelical-population-believers-rule.ts`
- Filter application: `src/lib/dataset-region-filtering.ts`
- Saved filter normalization and compatibility: `src/lib/saved-dataset-filters.ts`

## Rule Model

The persisted watchlist state supports:

```ts
watchlist: {
  evangelicalPopulationBelieversRuleEnabled?: boolean
  evangelicalPopulationBelieversRule?: {
    tiers: Array<{
      minPopulation: number
      maxPopulation: number | null
      minBelievers: number
    }>
  }
}
```

Default rule:

- `0-4,999 -> 50 believers`
- `5,000-10,000 -> 75 believers`
- `10,001+ -> 100 believers`

Guardrails enforced by validation and sanitization:

- tiers are integer-only
- first tier starts at `0`
- tiers stay sorted and contiguous
- only the final tier may be open-ended
- `minBelievers` cannot be negative
- tier count stays within `1..6`

## Editor Behavior

The Watchlist row keeps a compact plain-English summary of the configured tiers and opens the full editor in a centered popup.

Edits made inside the popup apply live to the current filter state. The popup itself is only an editing surface; it does not change persistence behavior or add a separate save/apply step.

## Graph Behavior

The graph uses:

- X axis: population
- Y axis: evangelical believers

It renders:

- a stepped threshold line for the configured rule
- draggable breakpoint handles for tier transitions
- draggable horizontal handles for each tier's minimum believers
- one draggable test dot for scenario evaluation
- summary cards for each tier's implied percentage

Numeric inputs remain available under the graph for precision edits, add/remove-tier actions, and keyboard-accessible adjustment.

## Pass / Fail Computation

For a dataset row or test scenario:

1. Find the tier that matches the current population.
2. Read that tier's `minBelievers` as the required minimum.
3. Compute actual believers as:

```ts
population * (percentEvangelical / 100)
```

4. Pass when:

```ts
actualBelievers >= requiredBelievers
```

The test scenario panel also shows:

- actual believers
- required believers
- actual percent
- required percent at the current population
- delta above or below the threshold

Color states:

- green: pass
- amber: pass, but within `max(5, ceil(requiredBelievers * 0.1))` believers of the threshold
- red: fail

## Implied Percentage

Each tier badge shows the implied percent at the relevant boundary:

- bounded tiers show the implied percent at the tier boundary
- the final open-ended tier shows the implied percent at its lower boundary and notes that the percent declines as population rises

This keeps the percentage visible as guidance without making users maintain a separate percent filter.

## Compatibility Rules

Saved filters and open presets now persist the tiered rule.

Compatibility handling remains in place:

- legacy flat evangelical believers filters are read and converted into a single open-ended tier
- legacy evangelical percent filters remain readable for older saved data
- when a tiered rule is present, legacy percent filtering is ignored

## Follow-Up Opportunities

- add pointer-level component coverage for drag interactions if browser-based UI tests become necessary
- consider inline labels directly on graph segments for dense tier sets
- consider optional snapping presets for common ministry planning thresholds
