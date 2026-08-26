## Why

The production map gives too little horizontal space to the geography and uses a heavy near-black selected-country stroke that competes with the count-based fill scale, especially for smaller countries at world zoom. Country selection also stops at a short text list, so users cannot carry the selected records into the table or inspect one record without manually recreating the selection.

## What Changes

- Make the map the full available content width by moving local search above it and selected-country results below it.
- Preserve fill color exclusively for matching-record intensity and replace the heavy selected-country outline with a thinner, consistent, accessible treatment at every zoom.
- Show the selected country's complete record set in a bounded result panel with individual checkboxes and select-all behavior.
- Add transient `View all in Table` and `View selected in Table` actions that scope the existing table without mutating saved filters, datasets, or source rows.
- Let users open one selected record in a read-only People Group profile sheet composed from that dataset row's visible fields.
- Keep ISO3 matching, canonical filtering, provider-free rendering, unmapped evidence, downloads, saved filters, and existing dataset actions unchanged.
- Extend component and browser coverage for responsive layout, keyboard operation, selection styling, table handoff, clearing temporary scope, and record profiles.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `dataset-map-exploration`: Refine the map layout and selected-country styling, and add transient country/record drill-down into the existing table and a read-only record profile.

## Impact

- Map presentation and interaction: `src/components/dashboard/dataset-country-map.tsx` and `src/components/dashboard/dataset-map-view.tsx`.
- Dataset orchestration and table state: `src/components/dashboard/dataset-detail-client.tsx`, `src/components/dashboard/use-dataset-table-state.tsx`, and `src/components/dashboard/dataset-table.tsx`.
- Tests: map/table component tests and `tests/ui/10-journeys.spec.ts`; any new sheet or browser-smoked surface will follow the existing smoke-marker contract.
- No new dependency, external map provider, API route, database migration, Supabase change, auth or admin-permission change, data-integrity mutation, or Vercel configuration change.
