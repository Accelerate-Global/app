## Why

Admins can currently configure API connection profiles and run them, but the run request stays synchronous and only preserves a short preview. The workflow needs durable async execution, visible run progress, and archived downloadable outputs so API-sourced data can become a dependable first step for later dataset workflows.

## What Changes

- Convert API connection runs from one blocking request into an admin-started async lifecycle with queued, running, success, and failed states.
- Persist timestamped run logs so the admin UI can show progress while a run is active.
- Persist output artifacts for every successful parsed run, including normalized rows for CSV export and a redacted raw response for JSON/debugging.
- Add admin-only run detail, run history, and output download APIs for JSON and CSV.
- Update the API Connections admin page to poll active runs, show the latest output, list archived outputs, and expose JSON/CSV downloads.
- Preserve existing secret-header handling, safe outbound URL checks, import/create/replace dataset behavior, same-origin guarded admin APIs, and `/dashboard/api-connections` smoke coverage.

Non-goals:
- No scheduled runs, retries, queue worker, or viewer-runnable profiles in this slice.
- No automatic output retention or cleanup policy beyond existing connection deletion cascading.
- No change to dataset viewer permissions outside outputs produced by admin API connection runs.

## Capabilities

### New Capabilities
- `api-connection-runs`: Admins can start saved API connection profiles asynchronously, inspect run progress and archived outputs, and download outputs in JSON or UTF-8-sig CSV form.

### Modified Capabilities
- None.

## Impact

- Affects admin UI and smoke-tracked route: `src/app/dashboard/api-connections/page.tsx`, `src/components/dashboard/api-connections-client.tsx`, and related component tests.
- Affects admin API contracts under `src/app/api/admin/api-connections/**`.
- Affects Supabase private schema and Drizzle schema in `src/db/schema.ts` plus a new migration under `supabase/migrations`.
- Affects API connection domain behavior in `src/lib/api-connections.ts`, API types in `src/lib/api-types.ts`, and validation/download helpers.
- Affects Supabase Storage usage for durable output artifacts; private tables remain RLS-enabled with public, anon, and authenticated privileges revoked.
- Affects verification lanes for app runtime, UI smoke contracts, database security, and migration drift.
