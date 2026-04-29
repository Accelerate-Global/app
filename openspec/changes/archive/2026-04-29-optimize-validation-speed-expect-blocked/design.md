## Context

The repo already has a verification planner, receipt reuse for terminal gates, app quality checks, UI smoke, database security, OpenSpec validation, and CI gates. Phase 1 added a local Expect.dev wrapper, but Phase 1.3 isolated a completion timeout that makes `qa:expect` unreliable as a pass/fail preflight until upstream tooling changes.

Timing evidence in `.tmp/verify-cache/timings.jsonl` shows the slowest loops are release orchestration, full UI smoke, ship-local verification, targeted/full smoke, database security, and full app quality. `verify:app` already supports `--lint`, `--test`, and `--build` flags, so Phase 2 can add a low-risk alias over existing behavior instead of writing a new runner.

## Goals / Non-Goals

**Goals:**

- Add one advisory fast local command for early TypeScript, lint, and Vitest feedback.
- Document fast/full/CI/release command ladders and slow-path bottlenecks.
- Make it clear that Expect.dev is installed but blocked as reliable pass/fail validation.
- Preserve `verify:change`, required command selection, receipt reuse, `verify:change:run`, CI gates, UI smoke, and database security semantics.

**Non-Goals:**

- Rewrite Playwright or Vitest suites.
- Delete tests, weaken assertions, hide flakes, or reduce coverage.
- Add Expect.dev to CI or required local gates.
- Mutate production Supabase data or add production-auth test artifacts.
- Add complex sharding, retries, or caching infrastructure.

## Decisions

- Use `verify:fast` as a package-script alias: `pnpm run typecheck && pnpm run verify:app -- --lint --test`. This reuses the existing TypeScript runner and app verifier flags while intentionally skipping the slower Next build for the coding loop.
- Keep `verify:fast` advisory. It helps developers and agents fail earlier but does not satisfy or replace `verify:change:run`.
- Document command ladders in `docs/testing/TESTING_STRATEGY.md` instead of changing CI workflows or broad validation semantics.
- Update root `AGENTS.md` so agents use `verify:fast` during thin-slice coding and treat `qa:expect` as blocked until a future no-cookie unauthenticated run exits cleanly.

## Risks / Trade-offs

- `verify:fast` skips `next build` and can miss build-only failures -> Keep `verify:app` and `verify:change:run` as terminal gates.
- Developers may mistake the fast alias for authoritative validation -> Label it advisory in docs and agent instructions.
- Timing evidence varies by machine and tree -> Document current local timing data as guidance, not a contractual SLA.
- Expect.dev may become reliable later -> Keep `qa:expect` installed and document retest conditions instead of removing the wrapper.
