## Why

Admins no longer want API request configuration exposed in the web app. API connection profiles should be maintained from the codebase, while the app remains useful for running existing connections and reviewing outputs.

## What Changes

- Remove API connection profile creation, editing, deletion, and preset configuration controls from the admin web UI.
- Keep the `/dashboard/api-connections` page as a run/output dashboard for existing or code-defined saved connections.
- Disable web HTTP create, update, and delete handlers for API connection profiles while keeping list, run, history, detail, and download endpoints available.
- Update tests and OpenSpec requirements to reflect the run-only dashboard behavior.

Non-goals:
- Do not remove the API connection run engine, output archive/download behavior, Supabase tables, or storage artifacts.
- Do not change dataset import semantics for saved connections.
- Do not change admin authorization or same-origin mutation guard behavior.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `api-connection-runs`: API Connections admin UI becomes a run-only dashboard, and profile write operations are no longer available through web HTTP endpoints.

## Impact

- Affects admin UI behavior in `src/components/dashboard/api-connections-client.tsx` and `/dashboard/api-connections`.
- Affects admin API contracts in `src/app/api/admin/api-connections/**` by disabling create, update, and delete profile writes.
- Affects tests for the API Connections page, client, and route handlers.
- Affects UI smoke coverage for the existing smoke-tracked `/dashboard/api-connections` page; route marker and registry entry remain.
- Affects Supabase-backed behavior only by removing web write paths; existing private tables, run records, RLS posture, and output storage remain unchanged.
