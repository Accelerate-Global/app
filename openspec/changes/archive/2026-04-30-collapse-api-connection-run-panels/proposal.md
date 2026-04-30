## Why

The API connection detail page currently keeps long operational panels expanded, which makes run status inspection harder on pages with verbose logs or many ingestion runs. The page should prioritize the operator's chosen context while keeping history and run details available on demand.

## What Changes

- Render `Run Detail` before `Ingestion History` on the API connection detail dashboard.
- Make both `Run Detail` and `Ingestion History` collapsible, with both sections collapsed on initial page load.
- Keep ingestion row selection updating the selected run without automatically opening the collapsed detail panel.
- Limit the visible ingestion history table body to five rows before vertical scrolling while preserving access to all runs.
- Non-goals: no changes to run initiation, polling, download links, admin authorization, API contracts, Supabase persistence, Vercel deployment behavior, or route-level smoke registration.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `api-connection-runs`: Update the API connection detail dashboard presentation requirements for collapsible run detail and ingestion history panels.

## Impact

- Affects `src/components/dashboard/api-connection-detail-client.tsx` and its direct component test.
- Updates the existing `api-connection-runs` OpenSpec behavior for the dashboard.
- Does not affect auth, admin permissions, data integrity, Supabase schema/storage, public APIs, or deployment configuration.
- UI smoke coverage remains on the existing API connection detail route; no new route or shared UI primitive is introduced.
