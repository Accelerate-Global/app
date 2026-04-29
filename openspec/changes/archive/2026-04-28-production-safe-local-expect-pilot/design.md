## Context

The repo already has mandatory verification planning through `pnpm run verify:change`, durable unit/component/API coverage through Vitest, deterministic local Playwright UI smoke backed by local Supabase, database security checks, OpenSpec validation, and PR workflows. Local timing data shows browser and release gates are the most expensive parts of the loop, so the pilot adds an advisory changed-area browser preflight before the heavier gates.

Expect.dev runs through `npx expect-cli@latest` and reads git changes to drive browser QA. The connected Supabase project available to developers is production, so authenticated browser QA is production-sensitive and must default to no cookie extraction and unauthenticated/read-only checks.

## Goals / Non-Goals

**Goals:**

- Provide one local package script for changed-area Expect.dev preflight.
- Document the testing workflow, lane order, production auth safety policy, and speed triage findings.
- Keep the existing local terminal gate and PR gates authoritative.

**Non-Goals:**

- Add Expect.dev to CI or make it a merge blocker.
- Replace Playwright UI smoke, Vitest, database security, OpenSpec, or `verify:change:run`.
- Automate production credential entry or mutate production data during pilot QA.
- Rewrite or weaken existing tests as part of Phase 1.

## Decisions

- Use a shell wrapper instead of adding a package dependency. This keeps the pilot local-only, avoids lockfile churn, and matches the requested `npx -y "expect-cli@${EXPECT_VERSION:-latest}" tui` invocation.
- Default to `--agent codex`, `--target changes`, `--url http://localhost:3000`, `--timeout 900000`, `--output text`, and `--no-cookies`. Cookie extraction is opt-in through `EXPECT_USE_COOKIES=1` only for explicitly approved, read-only authenticated checks.
- Keep `EXPECT_YES` opt-in so the default pilot remains review/confirm first while still allowing an agent or developer to run noninteractive local QA intentionally.
- Document optional Codex MCP configuration without editing user-global or machine-local Codex config.

## Risks / Trade-offs

- Expect.dev CLI flags may change because the wrapper uses `latest` by default -> Document the confirmed `expect tui` flags and keep `EXPECT_VERSION` override available.
- Read-only authenticated checks can still expose production data in local artifacts -> Default to `--no-cookies` and document that cookies, storage state, traces, screenshots, videos, downloads, and auth files must not be committed.
- Expect.dev findings are exploratory and not durable -> Promote only important, deterministic, likely-to-recur findings into persistent tests.
- The pilot adds another command to the workflow -> Position it before targeted durable checks and keep `verify:change:run` as the terminal gate.
