## 1. Planning And Verification Setup

- [x] 1.1 Run `pnpm run task:kickoff -- --scope src/lib/api-connections.ts --scope src/app/api/admin/api-connections/** --scope src/components/dashboard/api-connections-client.tsx --scope src/db/schema.ts --scope supabase/migrations/** --scope openspec/changes/async-api-connection-runs-outputs/**`.
- [x] 1.2 Rerun `pnpm run verify:change` and record required commands, targeted smoke subset, and local Supabase need before code edits.

## 2. Data Model And Output Serialization

- [x] 2.1 Add the private schema migration for run lifecycle timestamps, queued/running statuses, run logs, and run outputs.
- [x] 2.2 Update Drizzle schema and API types for run lifecycle, logs, and output metadata.
- [x] 2.3 Add shared output serialization helpers for normalized-row CSV with UTF-8 BOM and JSON artifact download metadata.
- [x] 2.4 Update schema and serialization tests.

## 3. Backend Async Runs And Downloads

- [x] 3.1 Split run creation from execution so the run endpoint creates a queued run and schedules execution with `after()`.
- [x] 3.2 Persist running/success/failed statuses, lifecycle timestamps, logs, redacted previews, normalized rows, raw JSON artifacts, and optional dataset import results.
- [x] 3.3 Add admin-only APIs for connection run history, run detail with logs/output metadata, and output downloads by `format=json|csv`.
- [x] 3.4 Update route and domain tests for authorization, async start response, polling data, output persistence, failure handling, and downloads.

## 4. Admin UI

- [x] 4.1 Update the API Connections client to poll active selected runs and refresh logs/output state.
- [x] 4.2 Show latest output with lifecycle status, logs, preview, dataset link, and JSON/CSV download actions.
- [x] 4.3 Show archived outputs in recent run history with per-run downloads and terminal/in-progress states.
- [x] 4.4 Update component tests and maintain existing route smoke markers.

## 5. Required Verification And Cleanup

- [x] 5.1 Run focused tests for changed same-stem files.
- [x] 5.2 Run `pnpm run smoke:check` after UI changes.
- [x] 5.3 Run terminal verification with `pnpm run verify:change:run`.
- [x] 5.4 Run required database checks, including `pnpm run db:security` and `pnpm run db:check-migration-drift` if listed by `pnpm run verify:change`.
- [x] 5.5 Stop repo-local Supabase/Docker services started for verification and run `docker builder prune -af` while preserving named volumes.
