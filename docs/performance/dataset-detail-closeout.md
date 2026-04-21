# Dataset Detail Performance Closeout

## Route
- Authenticated dataset detail route: `/dashboard/datasets/[datasetId]`

## Accepted Baseline
- Cold hydration was materially improved from a sequential `/rows` waterfall to a single `?all=true` fetch for source datasets with known row counts up to 20,000.
- Warm non-sort interactions are fast enough on the real authenticated route:
  - watchlist enable: about `46ms`
  - region toggle: about `71ms`
  - country search: about `30ms`
  - country toggle: about `33ms`
- Warm sort remains in the high-200ms range on the real authenticated route with:
  - `0` row-data requests
  - `0` network requests

## Biggest Wins
- Cached per-row filter facets removed repeated filter-key scans during warm interactions.
- Eager full `sortedRows` materialization was removed from the steady-state render path.
- Warm rerender fanout was reduced across the table shell, filter rail, and header path.
- The local authenticated profiling harness now produces repeatable JSON reports for real-route measurements.

## Experiments Tried
- Header rerender isolation
- Sort-key and comparator tracing plus sort-path caching
- Body render tracing on the real authenticated route
- Lighter center-body renderer prototype

## What Was Falsified
- Backend, auth, hydration, and request orchestration are not the warm-sort bottleneck.
- TanStack sort/accessor/comparator work is too small to explain the remaining warm-sort latency.
- Per-cell JS/render logic is also too small to explain the remaining latency.
- The `div-grid` center-body prototype did not beat the baseline and should not ship.

## Final Conclusion
- The remaining warm-sort cost is dominated by replacing and painting a mostly brand-new visible body slice after sort.
- Incremental tuning on the current grid architecture is no longer paying off.
- The current architecture has likely reached its practical warm-sort floor for this UX model.

## When To Revisit
- Reopen this path only for materially larger renderer, product, or architecture changes.
- Do not reopen it for small memo, accessor, or virtualization tweaks unless new route-level profiling evidence shows a different bottleneck.
