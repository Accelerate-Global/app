## 1. Verification Preflight

- [x] 1.1 Run `pnpm run verify:change` against the proposal-backed tracked tree and record every required command and targeted smoke subset.
- [x] 1.2 Run `pnpm run task:kickoff -- --scope 'src/components/dashboard/**' --scope 'tests/ui/**' --scope 'openspec/changes/add-live-run-progress/**'` and confirm whether the planned verification lane needs local Supabase.

## 2. Shared Progress Presentation

- [x] 2.1 Add a focused dashboard operation-progress presentation that supports explicit determinate and indeterminate modes, domain-provided phase copy, elapsed time, and status freshness.
- [x] 2.2 Ensure the presentation exposes named progress semantics, a polite live region for meaningful state changes, reduced-motion-safe feedback, and no per-second screen-reader announcements.
- [x] 2.3 Add direct tests for determinate versus indeterminate rendering, elapsed display, freshness warning/recovery, reduced-motion-independent text, and terminal-state removal.

## 3. API Connection Tests And Ingestions

- [x] 3.1 Integrate indeterminate live activity into queued and running API connection tests, using persisted timestamps and the existing polling lifecycle.
- [x] 3.2 Integrate distinct queued and running source-ingestion copy without implying that staged source rows are already a published dataset.
- [x] 3.3 Track successful poll freshness and repeated poll failures separately from durable run status, continue retrying, and recover the normal presentation after a successful refresh.
- [x] 3.4 Update `api-connection-detail-client` tests for test and ingestion phases, elapsed/freshness behavior, reload restoration, provider-independent rendering, poll recovery, and success/failure transitions.

## 4. Dataset Ingestion Progress

- [x] 4.1 Replace lifecycle-derived Google Sheets onboarding percentages with independent indeterminate progress for every queued or running tab import.
- [x] 4.2 Preserve independent success, failure, retry, elapsed, and freshness state for concurrent Sheet-tab ingestions.
- [x] 4.3 Align CSV onboarding and existing dataset replacement with the shared accessible progress contract while preserving their real stage percentage, row-count, cleanup, and terminal behavior.
- [x] 4.4 Update dataset onboarding and dataset upload direct tests for multi-item background ingestion, retry reset, measured CSV stages, replacement progress, and terminal outcomes.

## 5. UI Smoke Coverage

- [x] 5.1 Add stable literal smoke selectors for active connection-run and dataset-ingestion progress without introducing an unregistered shared UI primitive.
- [x] 5.2 Update the targeted Playwright journey to assert that queued/running test and ingestion progress is visible and that terminal results replace it.
- [x] 5.3 Run `pnpm run smoke:check` and fix any route, surface, selector, or fixture contract failures.

## 6. Required Verification

- [x] 6.1 Run the direct component tests for every touched same-stem test pair and fix all product or test-gap failures.
- [x] 6.2 Rerun `pnpm run verify:change`, then run and pass every command it lists under Required commands, including `pnpm run spec:validate`.
- [x] 6.3 Run `pnpm run verify:change:run` as the terminal gate, using the repo-required UI smoke execution environment when browser smoke is included.
- [x] 6.4 Confirm the implementation and verification are complete and the OpenSpec change is ready to archive before any ship-local or ship action.
