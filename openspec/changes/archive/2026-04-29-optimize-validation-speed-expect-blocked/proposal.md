## Why

The repo has strong validation, but the inner loop is still slow when agents reach for full app, browser, database, or release gates before cheaper checks have passed. Expect.dev is installed as a future local preflight lane, but it is currently blocked by an upstream completion timeout, so Phase 2 needs to optimize speed using the existing durable validation system.

## What Changes

- Add a local advisory `verify:fast` package script for early TypeScript, lint, and Vitest feedback before build, UI smoke, database security, terminal gates, or release checks.
- Document bottleneck timing evidence, fast/full/CI/release command ladders, common change-type command choices, and when not to run the full suite.
- Update agent workflow instructions to prefer the fast advisory lane during coding while keeping `verify:change:run` authoritative.
- Mark Expect.dev as local-only, experimental, and blocked as a pass/fail preflight until a safe no-cookie run exits cleanly.
- Preserve existing CI gates, terminal gates, UI smoke contracts, database security checks, and production Supabase safety policy.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `openspec-automation`: Adds an advisory fast validation lane and command-ladder policy for local workflow speed while preserving existing required verification gates.

## Impact

- Affected files: `package.json`, `docs/testing/TESTING_STRATEGY.md`, root `AGENTS.md`, and `openspec/changes/optimize-validation-speed-expect-blocked/**`.
- No changes to app routes, APIs, admin permissions, auth/session behavior, data integrity, Supabase schema/RLS, Vercel deployment behavior, UI smoke coverage, Playwright behavior, or CI workflow semantics.
- No tests are deleted or weakened, and no production data, cookies, auth state, browser profiles, traces, screenshots, videos, or production logs are used as artifacts.
