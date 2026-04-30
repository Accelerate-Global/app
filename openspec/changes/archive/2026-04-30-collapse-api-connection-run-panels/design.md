## Context

The API connection detail client already owns run selection, polling, DataGrid history, and selected run rendering in one client component. The current layout renders `Ingestion History` before `Run Detail`, and both cards are always expanded.

## Goals / Non-Goals

**Goals:**
- Use local React state to collapse `Run Detail` and `Ingestion History` by default.
- Preserve all existing run selection, polling, refresh, download, and import/test behavior.
- Cap the history table viewport to five visible rows before vertical scrolling.

**Non-Goals:**
- No new shared UI primitive, external dependency, route, API, Supabase, auth, or Vercel runtime change.
- No change to the DataGrid data model or server-side run list.

## Decisions

- Implement a local collapsible card pattern in the dashboard client instead of adding a shared primitive. This keeps the change scoped because no other surface needs the pattern yet.
- Use explicit `Button` toggles with `aria-expanded` and `aria-controls` so the collapsed sections remain keyboard and screen-reader accessible.
- Keep row selection independent from the `Run Detail` disclosure state. This preserves the user's requested collapsed state and avoids surprising page expansion.
- Use the existing `DataGridScrollArea` with a conditional height class for history overflow rather than slicing table data. This keeps sorting, selection, and all runs available.

## Risks / Trade-offs

- [Risk] The exact five-row height depends on header and row styling. -> Mitigation: use the existing compact row styling and a fixed viewport height sized for one header plus five table rows.
- [Risk] Collapsed content changes current component tests that query visible text immediately after render. -> Mitigation: update tests to open the relevant sections before asserting detail/history content.
- [Risk] Hidden content could be mistaken for removed data. -> Mitigation: keep descriptive collapsed headers and explicit expand/collapse controls.
