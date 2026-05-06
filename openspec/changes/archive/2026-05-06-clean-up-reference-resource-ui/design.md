## Context

`/dashboard` currently renders a Reference Resources card above Saved Datasets
and Datasets. `/dashboard/resources` already exists as the dedicated signed-in
resource landing page. `/dashboard/country-codes` renders a back link to the
dashboard and a visible-count badge in the control row. The admin API
Connections page renders a Resources table with an explicit Open column, while
the Connections table opens records by clicking the row.

## Goals / Non-Goals

**Goals:**
- Make `/dashboard/resources` the resource-navigation target from the
  country-code page.
- Keep the dashboard focused on saved and available datasets.
- Hide empty saved-dataset UI while preserving existing saved-table owner
  scoping and row actions.
- Align Resources row opening with the Connections table interaction model.

**Non-Goals:**
- No new resource registry, database migration, API route, or permission change.
- No change to captured API-run resource persistence or external URL values.
- No UI smoke route additions because no page route is added or removed.

## Decisions

- Remove the dashboard Reference Resources card rather than replacing it with
  another link, because Resources is already discoverable through the signed-in
  account menu.
- Gate `SavedTablesGrid` rendering on `savedTables.length > 0` in the dashboard
  client so saved datasets reappear immediately when user-owned saved tables
  exist.
- Keep the country-code filtered `visibleEntries` state for search and CSV
  export, but stop rendering the badge.
- Use row click and Enter/Space keyboard handlers for Resources rows. Internal
  built-in resource rows use Next router navigation; captured HTTP resources
  open in a new tab with `noreferrer`.

## Risks / Trade-offs

- External resource rows need script-driven navigation instead of a visible
  anchor in the action column. Tests will lock click and keyboard behavior so
  the table remains accessible.
- Hiding the empty saved-dataset section removes an explicit empty state. This
  matches the request and keeps saved-table management available once a user has
  saved tables.
