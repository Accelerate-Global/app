## Context

The dashboard dataset list currently renders as a fixed-width grid inside an
overflow scroller. That works on desktop, but on phone-sized viewports the first
column dominates and the Tags column sits offscreen. Dataset detail tables also
render raw CSV text; population amounts such as `17598700` are technically
correct but difficult to scan on mobile.

The relevant brownfield files are `src/components/dashboard/datasets-grid.tsx`
and `src/components/dashboard/saved-tables-grid.tsx` for dashboard rows,
`src/components/dashboard/use-dataset-table-state.tsx` for dataset table cell
rendering, and `src/lib/dataset-table-columns.ts` for dataset column/value
helpers.

## Goals / Non-Goals

**Goals:**
- Keep dataset tags visible on mobile dashboard rows without requiring
  horizontal scrolling.
- Keep saved dataset source/count/actions visible on mobile dashboard rows.
- Keep desktop dashboard list density and column alignment intact.
- Format population amount cells with comma thousands separators in the
  browser.
- Preserve raw values for sort/filter logic, downloads, APIs, storage, and CSV
  output.
- Verify the changed UI with direct tests, smoke contract checks, OpenSpec
  validation, and the repo terminal gate.

**Non-Goals:**
- No Supabase schema, RLS, local service, auth metadata, API contract, or Vercel
  runtime changes.
- No redesign of dataset filtering, saved tables, or CSV import/export.
- No new shared UI primitive or smoke route.

## Decisions

- Use a stacked mobile layout for dashboard dataset and saved dataset rows, then
  retain each existing multi-column grid from the medium breakpoint upward.
  Alternative considered: keep the horizontal scroller and add sticky metadata
  columns. That would preserve table structure but still hide important row
  metadata behind horizontal gestures on the smallest viewport.
- Keep action buttons visible in the mobile row stack. Alternative considered:
  hide secondary actions behind a menu. That would reduce vertical height but
  introduce a new menu smoke surface and make frequent actions less direct.
- Format display values only for population-like columns. The formatter will
  inspect the column key, raw label, and effective display label for
  `population`, then format integer text with `BigInt(...).toLocaleString`.
  Alternative considered: format every integer-like table cell. That would
  incorrectly alter IDs and code fields such as Kinship.
- Keep formatting at render time. Sort and filter helpers continue reading raw
  dataset values through `getDatasetCellValue`, so existing saved views and CSV
  downloads do not change.

## Risks / Trade-offs

- Population columns named with an abbreviation that does not include
  `population` will remain unformatted. Mitigation: the current people-group
  data uses labels such as `Population` and `PG_Population`; future exceptions
  can extend the helper without touching table rendering.
- Mobile rows become taller because tags and actions are visible. Mitigation:
  the dashboard list has a small number of datasets, and visible metadata is a
  better mobile trade-off than horizontal-only content.
- The formatter changes browser text expectations. Mitigation: add unit tests
  for formatted population cells and unchanged non-population numeric cells.
