## 1. OpenSpec

- [x] 1.1 Update the durable `api-connection-runs` scenarios for collapsed Run Detail and Ingestion History behavior.

## 2. UI Implementation

- [x] 2.1 Add local collapsible card controls for Run Detail and Ingestion History.
- [x] 2.2 Reorder Run Detail before Ingestion History while preserving selected-run and row-selection behavior.
- [x] 2.3 Constrain Ingestion History to five visible rows before scrolling without limiting available run data.

## 3. Tests and Verification

- [x] 3.1 Update the API connection detail client test for default collapsed state, section order, explicit expansion, row selection, and history viewport height.
- [x] 3.2 Run the direct component test, OpenSpec validation, smoke contract check, and current-tree verification gates from `pnpm run verify:change`.
