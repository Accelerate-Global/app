## 1. Planning

- [x] 1.1 Run `pnpm run verify:change` before implementation.
- [x] 1.2 Run `pnpm run task:kickoff -- --scope <owned paths>` for UI, admin, DB, and OpenSpec impact.

## 2. Resource Persistence

- [x] 2.1 Add the private API connection resources migration, Drizzle schema, shared API type, and security checks.
- [x] 2.2 Extract valid HTTP(S) resource URLs from parsed `Resource_##_*` rows, normalize hashes away for per-run dedupe, and skip blank or invalid URLs.
- [x] 2.3 Publish extracted resources from successful test and import runs before the run is marked successful.
- [x] 2.4 Return the newest 500 resources from the API Connections list data.

## 3. UI

- [x] 3.1 Render the Resources grid below the existing API Connections grid.
- [x] 3.2 Keep the detail page smoke markers contract-compliant.

## 4. Tests

- [x] 4.1 Cover resource extraction, invalid URL skipping, and within-run URL dedupe.
- [x] 4.2 Cover resource publishing for test and import run output paths.
- [x] 4.3 Cover list-page resource data, page/client rendering, migration/schema, and security expectations.

## 5. Verification

- [x] 5.1 Run focused Vitest for touched API connection, page/client, and schema tests.
- [x] 5.2 Run `pnpm run smoke:check`.
- [x] 5.3 Run `pnpm run spec:validate`.
- [x] 5.4 Rerun `pnpm run verify:change` and complete every required command.
- [x] 5.5 Run `pnpm run verify:change:run` before finalizing.
