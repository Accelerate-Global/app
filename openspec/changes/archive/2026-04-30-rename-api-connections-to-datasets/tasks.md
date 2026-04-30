## 1. Planning

- [x] 1.1 Run `pnpm run task:kickoff -- --scope 'src/app/dashboard/api-connections/**' --scope src/components/dashboard/api-connections-client.tsx --scope src/components/dashboard/api-connections-client.test.tsx --scope src/components/auth/account-control.tsx --scope src/components/auth/account-control.test.tsx --scope 'openspec/changes/rename-api-connections-to-datasets/**' --scope openspec/specs/api-connection-runs/spec.md`.
- [x] 1.2 Run `pnpm run verify:change` before implementation and record the required verification lane.

## 2. UI Implementation

- [x] 2.1 Rename visible top-level API Connections page and account menu labels to `Datasets` while keeping existing routes and smoke markers.
- [x] 2.2 Simplify the API connections index card to `Connections`, remove search/classification/status filters, and render all available connections.
- [x] 2.3 Remove the index table status header/cell while preserving connection, classification, last ingestion, and row navigation.
- [x] 2.4 Update the API connection detail back link to `Back to Datasets`.

## 3. Tests And Verification

- [x] 3.1 Update same-stem page, client, and account menu tests for renamed copy and removed controls.
- [x] 3.2 Run focused checks: `pnpm run spec:validate`, `pnpm run verify:fast`, direct same-stem tests, and `pnpm run smoke:check`.
- [x] 3.3 Rerun `pnpm run verify:change`, complete every required command it reports, and pass `pnpm run verify:change:run`.
- [x] 3.4 Archive the OpenSpec change after implementation and required verification pass.
