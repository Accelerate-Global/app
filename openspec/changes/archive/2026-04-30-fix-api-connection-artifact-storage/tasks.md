## 1. Planning

- [x] 1.1 Run `pnpm run verify:change` before code edits.
- [x] 1.2 Run `pnpm run task:kickoff -- --scope src/lib/api-connections.ts --scope src/lib/dataset-storage.ts --scope src/lib/api-connections.test.ts --scope src/lib/dataset-storage.test.ts --scope src/db/schema.test.ts --scope 'supabase/migrations/**' --scope 'openspec/changes/fix-api-connection-artifact-storage/**' --scope openspec/specs/api-connection-runs/spec.md`.

## 2. Implementation

- [x] 2.1 Add API connection artifact bucket helpers, MIME constants, and legacy read fallback order.
- [x] 2.2 Upload run JSON artifacts to the artifact bucket with bare `application/json`.
- [x] 2.3 Download run artifacts from the artifact bucket first and the legacy dataset bucket second.
- [x] 2.4 Add a Supabase migration for the private JSON-only artifact bucket.

## 3. Tests

- [x] 3.1 Add focused storage helper tests for defaults, env override, and read order.
- [x] 3.2 Add API connection run artifact upload/download regression tests.
- [x] 3.3 Add migration coverage for the artifact bucket name, MIME restriction, and size limit.

## 4. Verification

- [x] 4.1 Run focused tests for touched modules.
- [x] 4.2 Run `pnpm run verify:change` and every required command it lists.
- [x] 4.3 Run `pnpm run verify:change:run`.
- [x] 4.4 Stop repo-local Supabase/Docker services and run Docker cleanup if verification started them.
