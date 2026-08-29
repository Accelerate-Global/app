## 1. Planning and action audit

- [x] 1.1 Run `pnpm run verify:change` and the UI task kickoff for the owned dataset-detail and smoke-test paths.
- [x] 1.2 Confirm the dataset-level administrator menu contains Edit dataset and Partner exports while filtered-view creation stays contextual.

## 2. Dataset action implementation

- [x] 2.1 Add the administrator-only Dataset actions menu with Edit dataset navigation and a Partner exports entry.
- [x] 2.2 Support opening the existing Partner exports manager from the centralized menu without regressing manager/editor handoff.
- [x] 2.3 Rename Assign to dataset to Create dataset from current view across the component, sheet copy where applicable, tests, and smoke selectors.
- [x] 2.4 Keep Dataset actions and Table/Map visually separate in the shared toolbar and preserve non-admin rendering.

## 3. Tests and verification

- [x] 3.1 Update direct component/page tests for role visibility, menu actions, controlled export opening, and the renamed contextual action.
- [x] 3.2 Update UI smoke coverage and markers for the Dataset actions menu and Partner exports handoff.
- [x] 3.3 Run direct tests, `pnpm run verify:fast`, and `pnpm run smoke:check` during implementation.
- [x] 3.4 Run every command required by `pnpm run verify:change`, including the terminal `pnpm run verify:change:run`, and clean up any local browser or Docker/Supabase services started by verification.
