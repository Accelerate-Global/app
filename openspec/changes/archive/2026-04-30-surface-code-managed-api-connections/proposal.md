## Why

The API Connections dashboard now says profiles are managed from the codebase, but the implementation still only lists rows that already exist in `private.api_connections`. Environments without manually created rows therefore show an empty dashboard even though the repo contains provider-specific run support for IMB, Joshua Project, and Etnopedia.

## What Changes

- Add repo-owned built-in API connection definitions for the provider workflows already implemented in `src/lib/api-connections.ts`.
- Include those built-in connections in the admin API Connections list when matching database rows do not already exist.
- Materialize a built-in connection into `private.api_connections` when an admin starts a run, so the existing async run/history/output tables and foreign keys remain unchanged.
- Keep web profile create/update/delete endpoints unavailable.
- Do not expose request configuration controls in the dashboard.
- Do not commit provider secrets; Joshua Project continues to require an out-of-band secret before successful runs.

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `api-connection-runs`: saved API connections include repo-owned code-managed definitions that appear in the admin run dashboard and can be materialized for normal run execution.

## Impact

- Affects API connection listing and run startup behavior in `src/lib/api-connections.ts`.
- Affects admin list/run API behavior under `src/app/api/admin/api-connections/**` without reopening web profile write endpoints.
- Affects the admin dashboard data displayed by `src/app/dashboard/api-connections/page.tsx` and `src/components/dashboard/api-connections-client.tsx`, but no new UI smoke route or marker is expected.
- Affects tests for API connection library behavior, admin API routes, and the API Connections page.
- Supabase data integrity is preserved by materializing built-ins into the existing private table before creating run records; no migration, RLS, or storage change is planned.
- Does not change auth roles, admin permission checks, same-origin mutation guards, Vercel deployment behavior, or profile configuration UI.
