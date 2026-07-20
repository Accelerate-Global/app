## 1. Planning and Regression Coverage

- [x] 1.1 Run `pnpm run task:kickoff -- --scope 'src/components/dashboard/reference-resource-lifecycle*'` and `pnpm run verify:change` before editing implementation code.
- [x] 1.2 Add a colocated regression assertion for the explicit UTC active-version timestamp.

## 2. Implementation

- [x] 2.1 Replace implicit local-time lifecycle formatting with one deterministic UTC formatter for active and history timestamps.
- [x] 2.2 Run the direct lifecycle component test and `pnpm run verify:fast`.

## 3. Verification and Release

- [x] 3.1 Run every command required by `pnpm run verify:change`, followed by `pnpm run verify:change:run`.
- [x] 3.2 Verify the implementation against the proposal, design, and delta spec and mark the change ready for archive.
