## 1. Planning

- [x] 1.1 Run `pnpm run task:kickoff -- --scope <owned-path-or-glob>` for the dashboard UI scope.
- [x] 1.2 Run `pnpm run verify:change` before implementation and record required commands.

## 2. Implementation

- [x] 2.1 Update dashboard dataset rows to use a stacked mobile layout that exposes tags, row counts, and actions without horizontal scrolling.
- [x] 2.2 Add a browser display formatter for population-like integer table cells while preserving raw values for sort/filter/download flows.
- [x] 2.3 Wire the display formatter into dataset table cell rendering only.
- [x] 2.4 Update dashboard saved dataset rows to use the same stacked mobile metadata layout.

## 3. Tests And Verification

- [x] 3.1 Update same-stem direct tests for the dashboard dataset row layout and dataset table value formatter.
- [x] 3.2 Run focused direct tests for changed dashboard/table modules.
- [x] 3.3 Run `pnpm run smoke:check`.
- [x] 3.4 Run `pnpm run spec:validate`.
- [x] 3.5 Review registered pages at a mobile viewport and capture any remaining mobile UX findings.
- [x] 3.6 Rerun `pnpm run verify:change` and complete all listed required commands.
- [x] 3.7 Run `pnpm run verify:change:run` before finalizing.
