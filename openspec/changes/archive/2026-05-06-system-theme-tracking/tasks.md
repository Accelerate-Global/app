## 1. Theme State

- [x] 1.1 Update first-paint theme bootstrap to resolve `system`, clear legacy `ag-theme`, and preserve `.dark` plus `color-scheme` behavior.
- [x] 1.2 Replace two-state theme helpers with preference/resolved-theme helpers and system media-query subscription support.

## 2. Account Menu And Analytics

- [x] 2.1 Replace the account-menu single theme toggle with explicit `System`, `Light`, and `Dark` choices.
- [x] 2.2 Update `theme_toggled` analytics typing and allowed event properties for preference and resolved theme values.

## 3. Verification

- [x] 3.1 Update account-control and analytics tests for system default, manual overrides, legacy storage handling, live system changes, and analytics payloads.
- [x] 3.2 Run `pnpm run verify:change`, direct changed tests, `pnpm run smoke:check`, `pnpm run verify:change:run`, and `pnpm run spec:validate`.
