## Why

The Connections experience uses source-oriented terminology inconsistently and
splits a run list from its selected-run diagnostics into two separate cards.
This makes the relationship between a run row and its details less direct than
the rest of the dashboard's table-to-detail interactions.

## What Changes

- Rename the Connections index card from `Connected sources` to `Dataset sources`.
- Replace the separate collapsed `Run Detail` and `Ingestion History` cards with
  one `Run history` card containing the existing run DataGrid.
- Open the selected run's logs, error, preview, downloads, and imported-dataset
  link in a right-side detail sheet when an admin selects a run row.
- Add component and browser-smoke coverage for the renamed title, combined run
  history, and row-to-sheet interaction.
- Preserve run execution, polling, refresh, sorting, downloads, data, and admin
  authorization behavior.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `api-connection-runs`: Update the Connections index terminology and replace
  collapsed run diagnostics with one run-history table that opens row details in
  a side sheet.

## Impact

- Affects `src/components/dashboard/api-connections-client.tsx`,
  `src/components/dashboard/api-connection-detail-client.tsx`, their colocated
  tests, and the API-connection UI smoke journey.
- Changes admin-facing presentation and interaction only; API contracts,
  authentication, admin permissions, data integrity, Supabase, and Vercel
  deployment behavior are unchanged.
- UI smoke coverage expands to exercise the new run-detail sheet.
- Non-goals: changing run schemas, retention, polling, imports, provider
  behavior, source-status actions, or the top-level `Connections` page heading.
