## Why

The API Connections dashboard currently combines connection selection, run controls, latest output, and run history in one split layout. Admins need a clearer browse-and-drill workflow: first list available code-managed API connections, then open a dedicated page for one connection to initiate and monitor ingestion work.

## What Changes

- Replace the `/dashboard/api-connections` split layout with a Users-style searchable/filterable table of available API connections.
- Add `/dashboard/api-connections/[connectionId]` as an admin-only detail page for one API connection.
- Move run controls, run polling, logs, downloads, and previews to the detail page.
- Add a visual pipeline skeleton for Configure, Fetch, Normalize, Archive Output, and Import Dataset while keeping real v1 actions mapped to existing Test and Import run endpoints.
- Render ingestion history on the detail page with the existing DataGrid component stack.
- Keep existing run, history, detail, and download API contracts; do not add database migrations or new HTTP endpoints.

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `api-connection-runs`: API Connections gains a list-to-detail admin dashboard, a visual pipeline skeleton, and DataGrid ingestion history while preserving current run semantics.

## Impact

- Affects admin UI under `src/app/dashboard/api-connections/**` and `src/components/dashboard/api-connections*.tsx`.
- Affects server-side API connection lookup in `src/lib/api-connections.ts`.
- Affects UI smoke route registry coverage for the new dynamic detail route.
- Affects tests for API connection page routing, client interaction, DataGrid run history, and server resolver behavior.
- Does not change auth roles, same-origin guards, Supabase schema, storage schema, or Vercel deployment behavior.
