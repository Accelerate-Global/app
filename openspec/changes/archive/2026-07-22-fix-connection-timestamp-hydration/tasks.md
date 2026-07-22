## 1. Timestamp Contract

- [x] 1.1 Add a shared formatter that renders valid timestamps in explicitly labeled UTC and safely handles empty or invalid values.
- [x] 1.2 Replace the implicit-timezone formatters in the connection list and connection detail views with the shared contract.

## 2. Regression Coverage

- [x] 2.1 Add direct unit coverage for exact UTC formatting and fallback behavior.
- [x] 2.2 Update both affected component tests to assert visibly labeled UTC timestamps.

## 3. Verification and Release

- [x] 3.1 Run `pnpm run verify:change`, all required commands it reports, focused component tests, `pnpm run smoke:check`, `pnpm run test:ui:smoke:targeted`, and `pnpm run verify:change:run`.
- [x] 3.2 Verify the implementation against the OpenSpec change and sync the approved behavior into the durable capability spec.
