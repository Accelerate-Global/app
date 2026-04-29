## Why

The repo has strong local and CI validation, but the inner loop is expensive when browser regressions are discovered late in long validation runs. A local-only Expect.dev preflight can catch obvious changed-area browser issues earlier without weakening the existing durable tests or PR gates.

## What Changes

- Add a production-safe local Expect.dev preflight wrapper that defaults to Codex, current git changes, `http://localhost:3000`, no cookie extraction, and a read-only production Supabase safety prompt.
- Add a package script for the wrapper while keeping Expect.dev out of GitHub Actions and required CI gates.
- Document the current testing workflow, a faster testing methodology, production Supabase/auth safety limits, optional Codex MCP configuration, and Phase 2 speed opportunities.
- Preserve all existing verification gates, UI smoke requirements, OpenSpec validation, and CI behavior.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `openspec-automation`: Adds a local-only advisory Expect.dev preflight lane to the repo workflow policy while keeping OpenSpec, app quality, UI smoke, database security, and CI gates authoritative.

## Impact

- Affected files: `package.json`, `scripts/expect-preflight.sh`, `docs/testing/TESTING_STRATEGY.md`, root `AGENTS.md`, and `openspec/changes/production-safe-local-expect-pilot/**`.
- No changes to app routes, APIs, admin permissions, data integrity behavior, Supabase schema/RLS, Vercel deployment behavior, or UI smoke coverage.
- No new CI requirements and no dependency lockfile changes; Expect.dev is invoked through `npx` only for local pilot usage.
