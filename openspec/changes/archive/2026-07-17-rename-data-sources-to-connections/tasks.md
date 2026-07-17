## 1. Connections Index

- [x] 1.1 Rename the account-menu, index-page, and connection-detail labels to Connections.
- [x] 1.2 Rename the index creation action to Add connection and deep-link it to Google Sheets onboarding.
- [x] 1.3 Remove the reference-resources card and resource-only client props and rendering.

## 2. Connection Onboarding

- [x] 2.1 Render Add connection heading and connection-specific introduction for the Google Sheets deep link while preserving general Add dataset copy.
- [x] 2.2 Rename onboarding links back to the connection manager and update directly mapped tests.

## 3. Verification and Closeout

- [x] 3.1 Run direct page and component tests plus `pnpm run smoke:check` for the changed UI contracts.
- [x] 3.2 Run `pnpm run verify:change`, complete every required command through `pnpm run verify:change:run`, and resolve any product, test-gap, contract/harness, or environment failure.
- [x] 3.3 Verify the implementation against the OpenSpec artifacts and archive the completed change.
