## Why

Admins need a repeatable Joshua Project people-groups import that matches the working PGIC source script without manually rebuilding request parameters and output handling each time. The existing API Connections page already manages saved requests, secret storage, async runs, imports, and archived downloads, so the change should extend that workflow rather than introduce a separate ingestion path.

## What Changes

- Add a Joshua Project (PGIC) preset to the admin API Connections UI that pre-fills the people-groups endpoint, request parameters, JSON response settings, dataset naming, and PGIC classification.
- Store the Joshua Project API key through the existing secret-header/Vault flow; do not commit the provided key into client code or tracked configuration.
- During Joshua Project PGIC runs, append the stored `api_key` secret as an upstream query parameter and keep it out of run previews, logs, and saved connection URLs.
- Normalize Joshua Project people-group JSON output so `Resources` is flattened into indexed resource columns while preserving `Resources_raw`, matching the behavior of the provided Python script.
- Preserve existing generic API connection create, update, test, import, archive, and download behavior for non-Joshua connections.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `api-connection-runs`: Add provider-aware Joshua Project PGIC connection setup and output normalization while preserving existing run safety controls and import semantics.

## Impact

- Affects admin UI behavior in `src/components/dashboard/api-connections-client.tsx`.
- Affects API connection execution and row parsing in `src/lib/api-connections.ts`.
- Affects API connection tests under `src/lib/api-connections.test.ts` and `src/components/dashboard/api-connections-client.test.tsx`.
- Affects Supabase-backed behavior only through existing Vault/Storage/database helpers; no database schema or migration is planned.
- Affects admin-only API connection contracts, data integrity of imported rows, and the API Connections UI. It does not change auth roles, same-origin mutation guards, Vercel deployment behavior, or UI smoke route coverage.
