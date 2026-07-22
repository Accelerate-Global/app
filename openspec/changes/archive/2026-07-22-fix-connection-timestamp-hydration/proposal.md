## Why

Connection run timestamps are formatted during both server rendering and browser hydration without an explicit timezone. Vercel renders in UTC while the browser uses the user's local timezone, producing React text-hydration errors on the Connections pages even though the underlying run data is valid.

## What Changes

- Render connection and run timestamps with one explicit, deterministic timezone during server rendering and hydration.
- Label the displayed timezone so administrative run-history times are unambiguous.
- Add regression coverage for the deterministic timestamp contract on connection list and detail views.
- Preserve ingestion behavior, run data, artifact generation, and dataset publication behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `api-connection-runs`: Connection list and run-detail timestamps must render deterministically without server/client hydration mismatches.

## Impact

- Affected UI: `src/components/dashboard/api-connections-client.tsx` and `src/components/dashboard/api-connection-detail-client.tsx`.
- Affected tests: the corresponding component tests and browser verification for the existing Connections routes.
- No auth, admin-permission, data-integrity, Supabase, API-contract, dependency, or UI smoke route-coverage changes.
- Vercel deployment behavior is unchanged; the production deployment is required only to verify that the browser warning is gone.
- Non-goals: changing stored timestamps, introducing per-user timezone preferences, changing ingestion semantics, or altering run-history records.
