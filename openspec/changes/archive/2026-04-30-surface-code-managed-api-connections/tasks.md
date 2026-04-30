## 1. Planning

- [x] 1.1 Run `pnpm run verify:change` before implementation.
- [x] 1.2 Run `pnpm run task:kickoff -- --scope src/lib/api-connections.ts --scope src/components/dashboard/api-connections-client.tsx --scope src/app/dashboard/api-connections/page.tsx --scope src/app/api/admin/api-connections/** --scope src/lib/api-connections.test.ts --scope src/app/dashboard/api-connections/page.test.tsx --scope src/components/dashboard/api-connections-client.test.tsx --scope openspec/changes/surface-code-managed-api-connections/**`.

## 2. Implementation

- [x] 2.1 Add repo-owned built-in API connection definitions for IMB People Groups, Joshua Project PGIC, and Etnopedia.
- [x] 2.2 Include built-in definitions in `listApiConnections()` when no matching materialized row exists, without duplicating existing rows.
- [x] 2.3 Materialize a built-in definition into `private.api_connections` during authorized run startup before creating the queued run.
- [x] 2.4 Preserve unavailable web profile create/update/delete endpoints and existing run/history/download behavior.

## 3. Tests

- [x] 3.1 Add or update API connection library tests for built-in listing, de-duplication, and materialization on run start.
- [x] 3.2 Update page and client-facing tests so repo-owned saved connections render without configuration controls.

## 4. Verification

- [x] 4.1 Run focused tests for touched API connection modules and page behavior.
- [x] 4.2 Run `pnpm run spec:validate`.
- [x] 4.3 Rerun `pnpm run verify:change` and complete every required command.
- [x] 4.4 Run `pnpm run verify:change:run` before finalizing.
