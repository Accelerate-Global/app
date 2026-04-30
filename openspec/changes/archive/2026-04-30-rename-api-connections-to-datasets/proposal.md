## Why

The admin API Connections page is now used as an operational dataset ingestion entrypoint, but the visible label and index controls still describe a filterable API-connection catalog. Renaming the surface to Datasets and simplifying the index reduces UI noise without changing the existing route or API contracts.

## What Changes

- Rename visible admin navigation from `API Connections` to `Datasets` while keeping `/dashboard/api-connections` unchanged.
- Rename the `/dashboard/api-connections` page heading to `Datasets`.
- Rename the index card title from `Available API Connections` to `Connections`.
- Remove search, classification filter, and status filter controls from the index.
- Remove the index table `Status` column while preserving connection selection, classification, and last ingestion information.
- Update the detail-page back link to use the new visible `Datasets` section label.
- Non-goals: no route rename, API path rename, data model change, permission change, Supabase change, Vercel deployment change, or API connection run behavior change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `api-connection-runs`: The admin API Connections index changes from a searchable/filterable table with status to a simpler visible Datasets surface that lists connections without index filters or status.

## Impact

- Affects visible admin UI in `src/app/dashboard/api-connections/**`, `src/components/dashboard/api-connections-client.tsx`, and `src/components/auth/account-control.tsx`.
- Affects same-stem component/page tests for the renamed copy and removed controls.
- Affects UI smoke coverage only through existing route coverage; smoke route IDs and page markers remain unchanged.
- Does not affect auth, admin permission checks, data integrity, Supabase schema/runtime behavior, Vercel deployment behavior, or public HTTP API contracts.
