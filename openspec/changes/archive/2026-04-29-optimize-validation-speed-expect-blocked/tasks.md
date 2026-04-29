## 1. Planning

- [x] 1.1 Run `pnpm run verify:change` and `pnpm run task:kickoff -- --scope 'docs/testing/**' --scope package.json --scope AGENTS.md --scope 'openspec/**'` before implementation.
- [x] 1.2 Create OpenSpec proposal, design, delta spec, and implementation tasks.

## 2. Fast Validation Alias

- [x] 2.1 Add advisory `verify:fast` package script that runs `pnpm run typecheck && pnpm run verify:app -- --lint --test`.

## 3. Documentation

- [x] 3.1 Update `docs/testing/TESTING_STRATEGY.md` with the Phase 2 bottleneck table, fast/full/CI/release command ladders, common change-type command guidance, and Expect.dev blocked status.
- [x] 3.2 Update root `AGENTS.md` so agents use `verify:fast` in the thin-slice loop and treat `qa:expect` as blocked for pass/fail validation until a future safe retest exits cleanly.

## 4. Verification

- [x] 4.1 Run `pnpm run verify:fast`.
- [x] 4.2 Run `git diff --check`, `pnpm run spec:validate`, `pnpm run verify:change`, and `pnpm run verify:change:run`.
- [x] 4.3 Archive the completed OpenSpec change after required verification passes and rerun `pnpm run spec:validate`, `pnpm run verify:change`, and `pnpm run verify:change:run`.
