## 1. Planning

- [x] 1.1 Run `pnpm run verify:change` before implementation and capture required commands.
- [x] 1.2 Run `pnpm run task:kickoff -- --scope src/lib/api-connections.ts --scope src/components/dashboard/api-connections-client.tsx --scope src/app/api/admin/api-connections/** --scope src/lib/api-connections.test.ts --scope src/components/dashboard/api-connections-client.test.tsx --scope openspec/changes/add-etnopedia-api-connection/**`.

## 2. Etnopedia Connection Behavior

- [x] 2.1 Add an `Etnopedia` preset to the API Connections UI with the MediaWiki API URL, JSON response settings, PGIC dataset settings, and an Etnopedia dataset filename.
- [x] 2.2 Add Etnopedia MediaWiki export orchestration that lists people titles, fetches main and talk revisions in batches, and emits progress through the existing run logs.
- [x] 2.3 Port the script's Etnopedia wikitext parsing and row normalization into TypeScript helpers.
- [x] 2.4 Route matching Etnopedia API connection runs through the provider-aware export while preserving generic JSON/CSV behavior for all other connections.

## 3. Tests

- [x] 3.1 Add focused Etnopedia parser/orchestration tests with mocked MediaWiki responses.
- [x] 3.2 Update API Connections UI tests to cover the Etnopedia preset form behavior.
- [x] 3.3 Update API connection tests for Etnopedia URL detection and generic parser compatibility.

## 4. Verification

- [x] 4.1 Run focused tests for touched API connection modules/components.
- [x] 4.2 Run `pnpm run spec:validate`.
- [x] 4.3 Run `pnpm run typecheck`.
- [x] 4.4 Run `pnpm run verify:test-delta`.
- [x] 4.5 Run `pnpm run verify:app`.
- [x] 4.6 Run `pnpm run db:security`.
- [x] 4.7 Rerun `pnpm run verify:change`.
- [x] 4.8 Run terminal gate `pnpm run verify:change:run` and resolve required-check failures.
