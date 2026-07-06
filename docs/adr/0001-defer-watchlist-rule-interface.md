# ADR-0001: Defer a shared watchlist-rule interface

- **Status:** Accepted
- **Date:** 2026-06-10

## Context

The watchlist filter section is built from three rule modules with
structurally parallel shapes — defaults, normalize, is-default, match,
min/max constants — but no shared interface:

- `src/lib/evangelical-population-believers-rule.ts` (tiered builder rule)
- `src/lib/watchlist-jp-only-evangelical.ts` (simple thresholds)
- `src/lib/watchlist-engagement-phase.ts` (phase range)

A shared `WatchlistRule` seam (normalize / is-default / match behind one
interface, with the watchlist filter consuming a list of rule adapters) was
proposed during the 2026-06-10 architecture deepening review so that a new
rule becomes one adapter file instead of edits to the filter pipeline, the
builder UI, validation, and saved-state plumbing.

## Decision

Defer the shared interface. The three existing rules are
similar-but-not-identical: a tiered builder, a threshold pair, and a range
do not yet prove a common interface, and unifying three dissimilar things
risks a forced abstraction that callers must work around — interface
complexity without depth.

## Consequences

- Adding the next watchlist rule stays expensive (touches the filter
  pipeline, builder UI, validation, and saved-state plumbing).
- The three rule modules keep their parallel-but-independent shapes; drift
  between them is acceptable until the seam exists.
- **Revisit trigger:** a fourth watchlist rule is requested. Design the
  interface against four real implementations, not three.
