## Why

Mobile users cannot see dashboard dataset tags without horizontal scrolling, and
population values in dataset tables are hard to scan when rendered as bare digit
strings. The screenshots show both issues on production-sized mobile viewports,
so the dashboard needs a responsive presentation pass rather than a one-off
visual adjustment.

## What Changes

- Render dashboard dataset rows with a mobile-first layout that keeps dataset
  tags visible under each dataset name while preserving the existing desktop
  table-style grid.
- Render saved dataset rows with visible mobile source, count, and action
  metadata instead of a horizontal-only desktop grid.
- Format population-like dataset table values with thousands separators for
  readability in the browser.
- Preserve raw dataset values for filtering, sorting, downloads, APIs, and CSV
  output.
- Review registered pages at a mobile viewport and keep smoke/accessibility
  contracts intact.
- Non-goals: no auth, admin permission, Supabase, Vercel deployment, API
  contract, CSV import/export, or data model changes.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `dashboard-layout`: dashboard dataset lists and dataset detail tables gain
  explicit mobile readability requirements.

## Impact

- Affected UI: `src/components/dashboard/datasets-grid.tsx`,
  `src/components/dashboard/saved-tables-grid.tsx`,
  `src/components/dashboard/use-dataset-table-state.tsx`, and related tests.
- Affected helper behavior: browser-only display formatting in
  `src/lib/dataset-table-columns.ts`.
- Verification: direct Vitest coverage, `pnpm run smoke:check`,
  `pnpm run spec:validate`, and the repo terminal gate
  `pnpm run verify:change:run`.
- UI smoke coverage remains within existing page and shared primitive contracts;
  no new route, dialog, sheet, menu, tooltip, or popover is introduced.
