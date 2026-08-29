## 1. Dataset toolbar and permissions

- [x] 1.1 Compose the Table/Map controls beside the server-gated Partner exports action without moving admin authorization into the client.
- [x] 1.2 Update dataset page and client tests for admin, non-admin, and accessible view-switch behavior.

## 2. Unified summary and filters

- [x] 2.1 Compose Current filtered table and the memoized desktop Filters component inside one shared card.
- [x] 2.2 Preserve the standalone narrow-screen action bar and Filters sheet without duplicating active control instances.
- [x] 2.3 Update action-bar, filter-panel, and dataset-detail tests for the combined responsive composition.

## 3. Table sizing and surfaces

- [x] 3.1 Increase the desktop table viewport to align with the combined left column while retaining the existing narrow-screen height.
- [x] 3.2 Apply scoped semantic soft-surface colors to the dataset grid header, rows, pinned cells, and status surfaces in light and dark modes.
- [x] 3.3 Update dataset-table tests and dataset UI smoke assertions for height, surface styling, and control placement.

## 4. Verification and release

- [x] 4.1 Run `pnpm run verify:change`, all listed direct checks, and `pnpm run smoke:check` when required by the plan.
- [x] 4.2 Run `pnpm run verify:change:run`, resolve any product, test-gap, contract/harness, or environment failures, and verify the completed OpenSpec change.
- [x] 4.3 Sync and archive the verified OpenSpec change before release.
