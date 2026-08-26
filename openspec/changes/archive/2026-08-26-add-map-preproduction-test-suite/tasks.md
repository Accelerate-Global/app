## 1. Production-shaped Fixture

- [x] 1.1 Add and directly test a deterministic 1,500-row map fixture generator sourced from the repository country catalog.
- [x] 1.2 Bootstrap the separate workspace-visible pre-production dataset and publish its identity through the typed smoke payload.

## 2. Expanded Map Verification

- [x] 2.1 Add mapped and unmapped smoke count markers with same-stem component assertions.
- [x] 2.2 Add a desktop Pro journey covering large-dataset readiness, all filter categories, table/map parity, search, empty behavior, same-origin boundaries, and the local timing ceiling.
- [x] 2.3 Add cross-role access assertions plus mobile, dark-appearance, overflow, and keyboard-selection coverage.
- [x] 2.4 Register the new journeys and update change-impact selection tests so future map work executes them.

## 3. Verify and Close

- [x] 3.1 Run fixture/component tests, `pnpm run smoke:check`, and the focused browser subset while debugging.
- [x] 3.2 Run every command required by `pnpm run verify:change` and the terminal `pnpm run verify:change:run` gate.
- [x] 3.3 Archive `add-map-preproduction-test-suite`, rerun strict validation on the archived tree, and restore the local preview without deploying production.
