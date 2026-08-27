## Why

The dataset-detail page gives disproportionate space to the administrator-only partner export controls, separates the current filtered-table context from the filters that shape it, and renders the map with hard-coded teal/slate colors that do not match the AX design system or respond to appearance changes. The page should present these controls in a clearer hierarchy while preserving the existing dataset, export, filter, table, and map behavior.

## What Changes

- Replace the always-expanded Partner exports card with one administrator-only button that opens a smoke-covered slide-out containing the export explanation, existing profiles and runs, and the entry point to the existing profile editor.
- Move the Current filtered table summary and actions directly above the desktop Filters panel, with a compact action layout that fits the existing `22rem` filter column; retain a full-width accessible placement and Filters trigger on narrower viewports.
- Replace hard-coded map teal/slate styling with semantic AX design-system tokens for the count ramp, empty countries, borders, selected state, focus treatment, and map canvas.
- Make map styling update with the application's effective light or dark appearance without changing counts, selection, filtering, or geographic behavior.
- Extend direct component tests and the existing dataset-detail smoke journey for the new export slide-out, responsive layout order, and appearance-aware map palette.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `partner-export-profiles`: Change the dataset-page entry point from an expanded card to a button-led export-management slide-out while preserving the existing profile editor and admin-only behavior.
- `dashboard-layout`: Require the filtered-table summary to sit immediately above the desktop filter panel and remain usable in the narrow column and on smaller viewports.
- `dataset-map-exploration`: Require map colors to use semantic AX design-system tokens and follow the effective light or dark appearance.

## Impact

- Dataset page and export UI: `src/app/dashboard/datasets/[datasetId]/page.tsx` and `src/components/dashboard/dataset-partner-exports.tsx`.
- Dataset exploration layout: `src/components/dashboard/dataset-detail-client.tsx` and `src/components/dashboard/dataset-table-action-bar.tsx`.
- Map theming: `src/components/dashboard/dataset-country-map.tsx`, `src/components/dashboard/dataset-map-view.tsx`, the temporary map-scope presentation in `src/components/dashboard/dataset-detail-client.tsx`, and semantic aliases in `src/app/globals.css`.
- Coverage: the direct same-stem component tests plus `tests/ui/10-journeys.spec.ts` and `tests/ui/route-registry.ts` smoke metadata.
- UI smoke coverage changes because a new export-management sheet trigger/surface is introduced. No API contract, auth, admin-permission, data-integrity, Supabase, database, or Vercel deployment behavior changes are planned.
- Non-goals: changing export mapping/generation semantics, persisting Table/Map mode, altering filter evaluation, changing map geometry or counts, adding a hosted map provider, or changing role access.
