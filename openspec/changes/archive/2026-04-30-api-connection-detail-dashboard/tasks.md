## 1. Planning

- [x] 1.1 Run `pnpm run verify:change` before implementation.
- [x] 1.2 Run `pnpm run task:kickoff -- --scope src/app/dashboard/api-connections/** --scope src/components/dashboard/api-connections* --scope src/lib/api-connections.ts --scope src/lib/api-connections*.test.ts --scope tests/ui/route-registry.ts --scope openspec/**`.

## 2. Server and Routing

- [x] 2.1 Add a server-side API connection resolver that handles materialized rows and code-managed definitions.
- [x] 2.2 Add `/dashboard/api-connections/[connectionId]` with admin redirects, not-found handling, and smoke markers.
- [x] 2.3 Update UI smoke route registry for the dynamic detail page.

## 3. UI

- [x] 3.1 Convert the index page client to a Users-style searchable/filterable connection table.
- [x] 3.2 Build the detail page client with pipeline skeleton controls and existing test/import actions.
- [x] 3.3 Render ingestion runs in the detail page with the existing DataGrid stack and selected-run detail panel.

## 4. Tests

- [x] 4.1 Update API connection library tests for the connection resolver.
- [x] 4.2 Update index page/client tests for table rendering, filtering, and navigation.
- [x] 4.3 Add detail page/client tests for admin routing, not-found behavior, run actions, polling, DataGrid rows, and artifact links.

## 5. Verification

- [x] 5.1 Run focused Vitest for touched API connection modules and route pages.
- [x] 5.2 Run `pnpm run smoke:check`.
- [x] 5.3 Run `pnpm run spec:validate`.
- [x] 5.4 Rerun `pnpm run verify:change` and complete every required command.
- [x] 5.5 Run `pnpm run verify:change:run` before finalizing.
