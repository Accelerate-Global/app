## 1. Planning And OpenSpec

- [x] 1.1 Run `pnpm run verify:change` and record required commands, targeted smoke subset, and local Supabase need.
- [x] 1.2 Run `pnpm run task:kickoff -- --scope 'openspec/changes/analytics-failure-triage/**' --scope 'openspec/specs/analytics-failure-triage/**' --scope 'src/app/dashboard/analytics/**' --scope 'src/app/api/admin/analytics/**' --scope 'src/lib/analytics-store.ts' --scope 'src/lib/analytics-store.test.ts' --scope 'src/lib/validation.ts' --scope 'src/lib/validation.test.ts' --scope 'src/db/schema.ts' --scope 'src/db/schema.test.ts' --scope 'supabase/migrations/**'`.
- [x] 1.3 Create proposal, design, delta spec, and tasks for analytics failure triage.

## 2. Data Model And Store Logic

- [x] 2.1 Create a Supabase migration for `private.analytics_failure_triage`, migrate existing resolution rows as `resolved`, and remove the resolution-only table.
- [x] 2.2 Update Drizzle schema and schema tests for the new triage table and migration.
- [x] 2.3 Update analytics store types and queries to compute open, expected, and resolved grouped failures with reopening semantics.
- [x] 2.4 Add triage upsert validation and focused store tests for built-in expected, debugging, expected, resolved, and reopened groups.

## 3. Admin API And UI

- [x] 3.1 Add an admin-only triage mutation endpoint under `/api/admin/analytics/failure-triage` with payload validation.
- [x] 3.2 Add focused route tests for unauthenticated, non-admin, invalid payload, success, and unexpected failure responses.
- [x] 3.3 Update the analytics page to highlight failed recent events and show raw/open/expected/resolved failure group distinctions.
- [x] 3.4 Add scoped client triage controls for status and note updates without moving page data fetching to the client.
- [x] 3.5 Update analytics page tests and keep the existing `data-smoke-page="analytics"` marker.

## 4. Verification

- [x] 4.1 Run focused tests: `pnpm exec vitest run src/lib/analytics-store.test.ts src/app/dashboard/analytics/page.test.ts src/app/api/admin/analytics/failure-triage/route.test.ts src/lib/validation.test.ts src/db/schema.test.ts`.
- [x] 4.2 Run `pnpm run smoke:check` after the analytics UI change.
- [x] 4.3 Rerun `pnpm run verify:change` before terminal verification.
- [x] 4.4 Run `pnpm run verify:change:run` and complete every listed required command, including database checks.
- [x] 4.5 Stop repo-local Supabase/Docker services started for verification and run Docker cleanup while preserving named volumes.
