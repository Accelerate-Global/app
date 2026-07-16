## 1. Planning and Contracts

- [x] 1.1 Run `pnpm run verify:change` and the scoped `pnpm run task:kickoff` planning gate, then record the required verification lane and targeted smoke subset.
- [x] 1.2 Extend the Google Sheets provider configuration and connect request contract with backward-compatible workspace visibility.

## 2. Product Implementation

- [x] 2.1 Add the default-visible Google Sheets dataset visibility control, explanatory copy, and red `Private` tag preview to the setup flow.
- [x] 2.2 Persist the explicit visibility choice on every selected tab's connection.
- [x] 2.3 Apply saved visibility when the first import creates a dataset while preserving existing dataset visibility on refresh and defaulting legacy connections to visible.

## 3. Tests and Smoke Coverage

- [x] 3.1 Extend component tests for the default state, private preview, and explicit request payload.
- [x] 3.2 Extend route and domain tests for explicit private, omitted/default-visible, persistence, first-import behavior, and refresh preservation.
- [x] 3.3 Extend the Google Sheets UI smoke journey and run `pnpm run smoke:check`.

## 4. Verification

- [x] 4.1 Run direct touched-area tests and `pnpm run verify:fast`, fixing all product, test-gap, or harness failures.
- [x] 4.2 Run `pnpm run spec:validate`, rerun `pnpm run verify:change`, and complete every listed required command.
- [x] 4.3 Run `pnpm run verify:change:run` successfully on the candidate tracked tree and verify the OpenSpec implementation artifacts.
