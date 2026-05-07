## Why

Authenticated dashboard pages currently use different desktop container widths,
which makes adjacent pages feel misaligned. Table headers are also selectable,
creating distracting highlight behavior when users drag across data tables.

## What Changes

- Standardize authenticated dashboard page content and header alignment on one
  desktop width.
- Keep mobile padding and responsive behavior unchanged.
- Make table header text non-selectable in shared table primitives and the
  dataset DataGrid header layer.
- Preserve table body text selection.

## Capabilities

### New Capabilities
- `dashboard-layout`: authenticated dashboard shell width and table header
  selection behavior.

### Modified Capabilities
- None.

## Impact

- Affects authenticated dashboard page layout, the shared site header, shared
  table primitives, and DataGrid table headers.
- Affects UI smoke route rendering because multiple smoke-tracked dashboard
  pages use the shared shell.
- Does not change auth, data access, Supabase schema, RLS, API contracts,
  persistence, or deployment behavior.
