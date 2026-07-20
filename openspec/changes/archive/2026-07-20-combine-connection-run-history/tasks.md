## 1. Planning and Regression Coverage

- [x] 1.1 Run `pnpm run verify:change` and the UI task kickoff before editing implementation code.
- [x] 1.2 Update the Connections list component test for the `Dataset sources` title.
- [x] 1.3 Rewrite run-history component coverage for the always-visible table and row-opened detail sheet.

## 2. UI Implementation

- [x] 2.1 Rename the Connections index component title to `Dataset sources`.
- [x] 2.2 Replace the separate Run Detail and Ingestion History cards with one `Run history` card.
- [x] 2.3 Move selected-run diagnostics into a controlled right-side sheet opened by row selection.
- [x] 2.4 Add matching literal smoke trigger, surface, and ready markers for the run-detail sheet.

## 3. Browser Coverage and Verification

- [x] 3.1 Add the admin connection run-detail sheet journey to the route registry and UI smoke suite.
- [x] 3.2 Run the focused component tests, `pnpm run verify:fast`, and `pnpm run smoke:check`.
- [x] 3.3 Run every command required by `pnpm run verify:change`, then `pnpm run verify:change:run`.

## 4. OpenSpec Completion

- [x] 4.1 Verify implementation completeness, correctness, and design coherence against the change artifacts.
- [x] 4.2 Confirm the completed change is ready for archive and final tracked-tree verification.
