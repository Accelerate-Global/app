# Testing Strategy

This repo keeps the existing validation suite authoritative and provides Expect.dev as a local-only experimental preflight layer for changed browser-facing work. Expect.dev is not a CI gate, and as of Phase 2 it is blocked as reliable pass/fail validation by an upstream run-completion timeout.

## Expect.dev Source Check

Verified on 2026-04-28 from:

- https://www.expect.dev/
- https://github.com/millionco/expect
- https://github.com/millionco/expect/blob/main/docs/mcp.md

Local CLI checks confirmed `expect-cli@0.1.3`. The browser QA flags are on the `tui` subcommand:

```bash
npx -y expect-cli@latest tui --help
npm view expect-cli version
```

Confirmed `expect tui` flags:

- `--agent codex`
- `--target changes`
- `--url`
- `--message`
- `--no-cookies`
- `--timeout`
- `--output`

## Current Workflow Audit

| Lane | Command | Purpose | Local? | CI? | Blocks PR? | Speed/Pain Notes |
|---|---|---|---|---|---|---|
| Planning | `pnpm run verify:change` | Computes impacted domains and required checks | Yes | No | No | Fast planning gate |
| Kickoff | `pnpm run task:kickoff -- --scope ...` | Captures owned paths, dirty paths, smoke subset, Supabase need | Yes | No | No | Fast, required for agent UI/admin/DB/tooling work |
| OpenSpec | `pnpm run spec:validate` | Validates OpenSpec specs/changes | Yes | Yes | Yes | Fast, required for tracked changes |
| Typecheck | `pnpm run typecheck` | TypeScript static analysis | Yes | Via app quality | Yes when selected | Usually fast |
| App quality | `pnpm run verify:app` | Runs lint, Vitest, and build in parallel | Yes | Yes | Yes when selected | Local timings show about 18s average |
| Unit/component/API tests | `pnpm run test` | Vitest suite over `config`, `scripts`, `src` | Yes | Via app quality | Yes when selected | Durable targeted coverage |
| UI smoke contract | `pnpm run smoke:check` | Static UI smoke contract and fixture manifest check | Yes | Via UI smoke | Yes when selected | Fast; run after UI contract changes |
| Targeted UI smoke | `pnpm run test:ui:smoke:targeted` | Changed-route Playwright smoke subset | Yes | Yes when selected | Yes when selected | Local timings show about 1m average |
| Full UI smoke | `pnpm run test:ui:smoke` | Full Playwright smoke suite against local Supabase | Yes | Yes when selected | Yes when selected | Slowest routine gate, about 2m42s average, latest about 3m13s |
| DB security | `pnpm run db:security` | Local Supabase reset, RLS lint/tests | Yes | Yes when selected | Yes when selected | About 53s average; starts Docker/Supabase |
| Terminal local gate | `pnpm run verify:change:run` | Runs required local checks for current tracked tree | Yes | No | No | Use once near end, not as debug loop |
| Ship local | `pnpm run verify:ship:local` | Release-readiness local gate | Yes | No | Pre-ship | About 2m average; use after change gate |
| CI app quality | `.github/workflows/app-quality.yml` | PR lint/test/build selection | No | Yes | Yes when required | Diff-selected |
| CI UI smoke | `.github/workflows/ui-smoke.yml` | PR targeted/full smoke selection | No | Yes | Yes when required | Diff-selected |
| CI DB security | `.github/workflows/database-security.yml` | PR DB security selection | No | Yes | Yes when required | Supabase-backed |
| CI OpenSpec | `.github/workflows/openspec.yml` | Validates specs and archive readiness | No | Yes | Yes | Always validates OpenSpec state |
| CI dependency audit | `.github/workflows/dependency-audit.yml` | High-severity dependency audit | No | Yes | Yes when required | Manifest/lockfile only |
| Release health | `.github/workflows/release-health.yml` | Checks production release health after `main` deploy | No | Yes, on `main` | Post-merge signal | Not an inner-loop check |
| Expect.dev preflight | `pnpm run qa:expect` | Local browser QA on current git changes | Yes | No | No | Installed but blocked as pass/fail validation until a safe no-cookie run exits cleanly |

## Testing Methodology

Intended order:

```text
Code diff
-> cheap/static checks
-> targeted persistent tests
-> full local validation
-> CI/PR gates
```

Use `pnpm run verify:change` before editing and `pnpm run verify:change:run` as the terminal local gate before finalizing tracked repo changes. Do not use repeated terminal gate runs as the debugging loop.

Expect.dev was intended to sit between cheap/static checks and targeted persistent tests. Until a safe no-cookie unauthenticated run exits cleanly, keep `pnpm run qa:expect` experimental and do not rely on it for pass/fail confidence.

### Lane 0 - Cheap/static checks

Purpose: catch obvious TypeScript, lint, formatting, and build-contract issues before browser or database-heavy checks.

Common commands:

- `pnpm run verify:fast`
- `pnpm run typecheck`
- `pnpm run verify:app -- --lint`
- `pnpm run verify:app -- --test`
- `pnpm run test -- <focused-file-or-pattern>`
- focused component tests under Vitest/jsdom
- `pnpm run smoke:check` when UI smoke contracts changed

### Lane 1 - Expect.dev local preflight (blocked)

Purpose: future quick browser/runtime QA on the changed area only.

Current Phase 2 status: installed but blocked by Expect.dev/Codex run-completion behavior. Do not treat `qa:expect` as passing validation until a safe no-cookie unauthenticated run exits cleanly.

Run:

```bash
pnpm run qa:expect
```

Defaults:

- agent: `codex`
- target: `changes`
- URL: `http://localhost:3000`
- timeout: `900000`
- output: `text`
- cookies: disabled with `--no-cookies`

Scope:

- changed routes
- navigation
- auth redirects
- visible UI regressions
- forms
- tables
- console errors
- failed network requests
- accessibility smoke issues
- obvious performance regressions

Expected use:

- Start the local app with `pnpm dev` when the target URL is not already running.
- Prefer unauthenticated checks first.
- Fix obvious findings and rerun Expect.dev once.
- Do not broaden into unrelated full-regression testing.
- Do not treat Expect.dev output as a durable test receipt.
- Retest only after `expect-cli` is newer than `0.1.3`, Codex CLI is newer than `0.125.0`, or Expect.dev updates its bundled Codex ACP adapter.

### Lane 2 - Targeted persistent tests

Purpose: add durable coverage only for behavior that should remain protected.

Promotion rule:

```text
Promote an Expect.dev finding into a persistent test only if the bug is important, deterministic, and likely to recur.
```

Use the smallest durable test that matches the bug:

- Vitest unit/API/component test for logic, data mapping, API permissions, auth redirects, and component behavior.
- `pnpm run smoke:check` for missing UI smoke contracts.
- Targeted Playwright journey only when the generic route sweep and unit/component tests cannot protect the behavior.

### Lane 3 - Full local validation

Purpose: authoritative pre-PR confidence.

Run:

```bash
pnpm run verify:change
pnpm run verify:change:run
```

`verify:change:run` executes the required commands for the current tracked tree and may reuse valid local receipts. If UI smoke or DB security starts local Supabase/Docker, stop the repo-local stack before finishing unless the user explicitly asks to keep it running.

### Lane 4 - CI gates

Purpose: final merge protection.

PR gates remain:

- App Quality
- OpenSpec
- UI Smoke
- Database Security
- Dependency Audit

Expect.dev must not be added as a required CI gate in Phase 1.

### Lane 5 - Optional full regression/nightly

Purpose: expensive broad coverage outside the inner loop.

Candidates:

- full UI smoke beyond targeted selection
- ship-local verification
- broad manual QA
- future scheduled or nightly Expect.dev explorations only if they remain non-destructive and outside PR blocking gates

## Production Supabase/Auth Safety

The connected Supabase project is production. Treat all authenticated testing as production-sensitive.

Default policy:

- Prefer unauthenticated checks first.
- `pnpm run qa:expect` defaults to `--no-cookies`.
- For authenticated checks, a developer may manually sign in through the local app using their normal browser session only when the checks are read-only.
- Cookie extraction is opt-in with `EXPECT_USE_COOKIES=1` and must be used only for explicitly approved, read-only authenticated checks.
- Do not automate credential entry unless a safe production test account already exists and the user explicitly approves its use.
- Do not create, update, delete, invite, publish, revoke, rollback, reset passwords, change permissions, or otherwise mutate production data during Expect.dev pilot testing.
- Do not commit secrets, cookies, local storage, storage-state files, browser profiles, screenshots, traces, videos, downloaded artifacts, or logs that expose production data.
- Avoid admin flows that mutate production data or permissions.
- If a route cannot be safely checked without mutation, document it as `not safe for Expect.dev Phase 1` and defer it.

## Expect.dev Commands

Default local preflight:

```bash
pnpm run qa:expect
```

Common overrides:

```bash
EXPECT_URL=http://localhost:3100 pnpm run qa:expect
EXPECT_MESSAGE="Check the changed anonymous sign-in route only." pnpm run qa:expect
EXPECT_OUTPUT=json pnpm run qa:expect
EXPECT_VERSION=0.1.3 pnpm run qa:expect
```

Read-only authenticated checks, only with explicit approval:

```bash
EXPECT_USE_COOKIES=1 pnpm run qa:expect
```

Noninteractive local run, only when the planned scope is already reviewed:

```bash
EXPECT_YES=1 pnpm run qa:expect
```

The wrapper forwards extra CLI arguments after its defaults:

```bash
pnpm run qa:expect -- --browser-mode headless
```

## Optional Codex MCP Config

If a developer wants Expect.dev MCP tools in Codex, add this to their Codex MCP config manually:

```toml
[mcp_servers.expect]
command = "npx"
args = ["-y", "expect-cli@latest", "mcp"]
startup_timeout_sec = 20
```

Do not modify user-global Codex config automatically for this repo.

## Validation Record

Phase 1 implementation evidence:

- CLI command checked: `npx -y expect-cli@latest tui --help`
- CLI version checked: `npm view expect-cli version`
- Confirmed version: `0.1.3`
- Confirmed browser QA command: `expect tui`
- Local wrapper: `pnpm run qa:expect`
- Default URL: `http://localhost:3000`
- Local dev server required: yes; `pnpm dev` was used for Phase 1 validation
- Default authentication: none, because the wrapper passes `--no-cookies`
- Production data posture: unauthenticated/read-only first; mutation is out of scope
- Wrapper help validation: `pnpm run qa:expect -- --help` passed
- Pilot run status: blocked after the CLI initialized the Codex ACP adapter; the run did not honor the 120s timeout during startup and was stopped manually
- Authentication used: none
- Read-only scope: yes
- Issues found: none reported before the adapter hang
- Fixes made: none
- Limitations: authenticated production flows that require mutation are not safe for Expect.dev Phase 1; full pilot execution also depends on Expect.dev/Codex adapter startup reliability

## Phase 1.1 Diagnostics

Outcome: **Outcome C - Codex CLI/ACP bug or incompatibility**. The first blocker is outside the repo wrapper and outside Expect.dev browser execution: bare `codex exec` fails before Expect.dev is involved.

Environment recorded on 2026-04-28:

- `node --version`: `v25.9.0`
- `pnpm --version`: `10.12.4`
- `npm --version`: `11.12.1`
- `npx -y expect-cli@latest --version`: `0.1.3`
- `npm view expect-cli version`: `0.1.3`
- `codex --version`: `codex-cli 0.116.0`
- `which codex`: `/opt/homebrew/bin/codex`
- `uname -a`: `Darwin Air.local 25.3.0 Darwin Kernel Version 25.3.0: Wed Jan 28 20:54:55 PST 2026; root:xnu-12377.91.3~2/RELEASE_ARM64_T8132 arm64`
- `pwd`: `/Users/blake/Documents/accelerate-global/online`
- `git status --short`: Phase 1 pilot files were still uncommitted; no unrelated repo files were modified by the diagnosis.

Smallest Codex repros:

```bash
codex exec "Reply with exactly PONG and do not inspect files."
```

From both the repo root and an empty `mktemp -d` directory, this exits with:

```text
Error loading config.toml: missing field `path`
in `skills.config`
```

The relevant local-machine config shape is a global `~/.codex/config.toml` `[[skills.config]]` entry named `vercel:ai-sdk` with `enabled = false` but no `path`. Do not edit this user-global file from repo automation.

After bypassing the malformed skills entry, Codex reaches model startup but the configured default model is incompatible with the installed CLI:

```bash
codex exec -c 'skills.config=[]' "Reply with exactly PONG and do not inspect files."
```

This fails with:

```text
The 'gpt-5.5' model requires a newer version of Codex. Please upgrade to the latest app or CLI and try again.
```

The minimal successful Codex proof is:

```bash
codex exec -c 'skills.config=[]' -m gpt-5.4 "Reply with exactly PONG and do not inspect files."
```

That command exits successfully and prints `PONG`.

Expect.dev surface checks:

- `pnpm run qa:expect -- --help`: passed
- `npx -y expect-cli@latest tui --help`: passed
- Full pilot command that previously hung after ACP initialization:

```bash
EXPECT_YES=1 \
EXPECT_TIMEOUT=120000 \
EXPECT_MESSAGE="Validate the local Expect.dev wrapper on this repository diff. The current changes are docs and local tooling, so perform only a safe unauthenticated smoke check of http://localhost:3000 if useful. Do not sign in. Do not use cookies. Do not create, update, delete, invite, publish, revoke, reset, or mutate production data. Do not edit files." \
pnpm run qa:expect -- --browser-mode headless
```

The hang occurred after Expect.dev printed:

```text
Initializing AcpClient
adapter: .../node_modules/@zed-industries/codex-acp/bin/codex-acp.js
```

Classification details:

- Not a wrapper bug: wrapper help reaches `expect tui --help`, and the core Codex command fails independently.
- Not local app boot: `codex exec` fails in an empty temp directory without the app.
- Not auth/cookie/session behavior: the failing repro does not open a browser, use cookies, or authenticate.
- Not production data behavior: no sign-in or production mutation occurs.
- Not repo context size or AGENTS instructions: the same bare failure happens outside the repo.

Recommended local remediation:

- Upgrade the Codex CLI/app so the configured default `gpt-5.5` model is supported, or temporarily run Codex with a supported model such as `-m gpt-5.4`.
- Repair or remove the malformed global `[[skills.config]]` entry in `~/.codex/config.toml`; if keeping that skill config, include the required `path`.
- Keep Expect.dev local-only and no-cookie by default. Do not add CI gates, production auth automation, or mutation checks as part of this diagnosis.

## Phase 1.2 Local Repair

Local repair performed on 2026-04-28:

- Backed up `~/.codex/config.toml` to `~/.codex/backups/config.toml.20260428-160321.bak`.
- Replaced the malformed global skills entry:

```toml
[[skills.config]]
name = "vercel:ai-sdk"
enabled = false
```

with:

```toml
[skills]
config = []
```

- Upgraded Codex through Homebrew Cask:

```bash
brew upgrade --cask codex
```

Codex version result:

- Before: `codex-cli 0.116.0`
- After: `codex-cli 0.125.0`
- `codex exec -c 'skills.config=[]' -m gpt-5.5 "Reply with exactly PONG and do not inspect files."`: passed
- Fallback model needed: no
- `codex exec "Reply with exactly PONG and do not inspect files."` from repo root: passed
- `codex exec "Reply with exactly PONG and do not inspect files."` from a non-git temp directory: blocked by Codex CLI trust/git-repo policy
- `codex exec --skip-git-repo-check "Reply with exactly PONG and do not inspect files."` from a non-git temp directory: passed
- `git init` temp directory plus bare `codex exec "Reply with exactly PONG and do not inspect files."`: passed

Expect.dev Phase 1.2 no-cookie pilot:

```bash
EXPECT_YES=1 \
EXPECT_USE_COOKIES=0 \
EXPECT_TIMEOUT=120000 \
EXPECT_MESSAGE="Open only the unauthenticated homepage or login page. Do not sign in. Do not use cookies. Do not click any action that mutates data. Report whether the page loads, whether console errors appear, and whether network requests fail." \
pnpm run qa:expect
```

Result:

- ACP startup blocker: fixed. Expect.dev initialized ACP, created a Codex session, and started browser checks.
- Local app involvement: `pnpm dev` served `http://localhost:3000`.
- Auth/cookies: no sign-in and cookie extraction disabled.
- Production mutation: none.
- Page result: homepage loaded at `http://localhost:3000/` with title `Accelerate Global`; login form, email input, and password input were visible.
- Console/network result reported by Expect.dev before timeout: no console errors after load and no failed, duplicate, or mixed-content requests.
- Final command status: failed after the 120s timeout while verifying the session stayed unauthenticated and cookie-free.
- Changed-area preflight status: not run, because the narrow no-cookie pilot did not exit successfully.
- Cleanup: generated `.expect` files were removed and the local dev server was stopped.

Remaining limitation:

- The original Codex ACP startup hang is repaired. The current blocker is narrower: Expect.dev can run the browser check but does not finish the final no-cookie/session verification step within the configured 120s timeout.

## Phase 1.3 Completion Timeout Isolation

Outcome: **Outcome E - Expect.dev/Codex completion bug**. Codex ACP startup is fixed, the local app serves the unauthenticated homepage, and no cookies or authentication are used, but Expect.dev does not terminate successfully in any safe tested mode before the configured timeout.

Diagnostic setup on 2026-04-28:

- Local app: `pnpm dev` on `http://localhost:3000`
- Authentication: none
- Cookies: disabled with `--no-cookies`
- Production mutation: none
- Expect.dev version: `0.1.3`
- Supported `expect tui --target` values: `unstaged`, `branch`, `changes`
- Explicit single-page target: not supported by the current CLI; `--url` only supplies base URL(s)

Commands tested:

| Probe | Command shape | Result |
|---|---|---|
| Short wrapper prompt | `EXPECT_YES=1 EXPECT_USE_COOKIES=0 EXPECT_TIMEOUT=180000 EXPECT_MESSAGE="Open the unauthenticated homepage only. Do not sign in. Do not click anything. Do not inspect cookies. Report page title, URL, console errors, and failed network requests, then stop." pnpm run qa:expect` | Failed after `3m`; ACP initialized, session was created, and the browser task started. |
| Direct CLI comparison | `npx -y expect-cli@latest tui --agent codex --target changes --url http://localhost:3000 --no-cookies --yes --timeout 180000 --message "...same short prompt..."` | Failed after `3m` with the same behavior, so the wrapper is not the cause. |
| Text output | Wrapper default `EXPECT_OUTPUT=text` | Failed after `3m`; same behavior as the direct CLI comparison. |
| JSON output | `EXPECT_OUTPUT=json ... pnpm run qa:expect` | Failed after `3m`; returned JSON with `status: "failed"`, `duration_ms: 180000`, empty `steps`, and summary `Timed out after 3m`. |
| Target `unstaged` | `EXPECT_TARGET=unstaged ... pnpm run qa:expect` | Failed after `3m`; target changed to `WorkingTree` and prompt length increased, but completion did not improve. |
| Omitted direct target | Direct CLI without `--target` | Failed after `3m`; behaved like default `changes`. |

Classification details:

- Not a prompt issue: removing session-verification and cookie-inspection language still timed out.
- Not a wrapper issue: direct CLI and the wrapper fail the same way.
- Not an output-mode issue: both `text` and `json` time out.
- Not a target-mode fix: `changes`, `unstaged`, and omitted target all time out; no single-page target exists in the current CLI.
- Not an auth/cookie issue in this phase: no sign-in occurred and cookie extraction stayed disabled.
- Not a production data issue: only unauthenticated homepage loads were attempted.

Recommended daily use:

- Keep `pnpm run qa:expect` as a local-only experimental pilot command, but do not rely on it for pass/fail confidence until Expect.dev exits cleanly in a no-cookie unauthenticated run.
- Do not add `qa:expect:smoke` yet. No safe unauthenticated Expect.dev mode completed successfully, so there is no stable smoke alias to expose.
- Continue using the documented fast-to-slow methodology: cheap/static checks, targeted durable tests, then `pnpm run verify:change:run` as the authoritative local gate.

Smallest upstream repro:

```bash
pnpm dev
npx -y expect-cli@latest tui \
  --agent codex \
  --target changes \
  --url http://localhost:3000 \
  --no-cookies \
  --yes \
  --timeout 180000 \
  --message "Open the unauthenticated homepage only. Do not sign in. Do not click anything. Do not inspect cookies. Report page title, URL, console errors, and failed network requests, then stop."
```

Cleanup performed:

- Removed generated `.expect` artifacts after diagnostic runs.
- Stopped the local dev server.
- No browser profile, cookie, storage-state, trace, screenshot, video, production-data log, auth artifact, Docker service, or Supabase service was intentionally created.

## Phase 2 Speed Optimization

Phase 2 optimizes the existing validation workflow while Expect.dev is blocked. The change adds an advisory fast lane and keeps all required local and CI gates unchanged.

### Bottleneck Table

| Command | Current duration | Purpose | Bottleneck | Can be targeted? | Recommended use |
|---|---:|---|---|---|---|
| `pnpm ship` | avg 6m30s, latest 11m50s | Release orchestration | Remote checks and release workflow | No | Release only |
| `pnpm run verify:ship:local` | avg 2m14s, latest 4m26s | Release-readiness local gate | Broad release-local validation | Partly via receipts | After `verify:change:run`, pre-ship only |
| `pnpm run test:ui:smoke` | avg 2m30s, latest 3m13s | Full Playwright UI smoke | Browser run plus local Supabase setup | Yes | Only when selected by `verify:change` or debugging browser-specific failures |
| `test:ui:smoke:targeted+full` | avg 2m35s | Combined smoke lane | Targeted and full browser smoke in one pass | Yes | Ship-local when targeted and full smoke are both needed |
| `pnpm run test:ui:smoke:targeted` | avg 1m09s | Changed-area Playwright UI smoke | Browser run plus local Supabase setup | Yes | Browser-facing changes when selected |
| `pnpm run db:security` | avg 52.8s | Local Supabase reset, RLS lint/tests | Supabase start/reset and database tests | No broad shortcut | DB/security changes only |
| `pnpm run verify:app` | avg 18.5s, latest 17.0s | App quality bundle | lint, Vitest, and Next build | Yes via `--lint`, `--test`, `--build` | Terminal app quality gate |
| `pnpm run verify:fast` | new alias over existing checks | Early app feedback | Typecheck, lint, and Vitest | Yes via targeted tests afterward | During coding before slower gates |
| `pnpm run typecheck` | avg 2.1s | TypeScript static analysis | TypeScript only | N/A | Early and often |
| `pnpm run spec:validate` | avg 807ms | OpenSpec validation | Spec tree validation | N/A | Every tracked change |
| `pnpm run verify:change:run` | avg 1m08s, latest 121ms with receipt reuse | Runs selected terminal gates | Required command set for current tree | Yes via prior narrow checks and receipts | Once near the end |

### Command Ladder

Fast path while coding:

```bash
pnpm run verify:change
pnpm run verify:fast
pnpm run test -- <focused-file-or-pattern>
pnpm run smoke:check
pnpm run test:ui:smoke:targeted
```

Use only the commands relevant to the change. `verify:fast` exists so agents do not run the full suite before narrower TypeScript, lint, and Vitest checks pass. Run `smoke:check` after UI smoke contract changes. Run targeted UI smoke only when the changed area is browser-facing and selected by `verify:change`, or when isolating a browser-specific failure.

Full local path before PR:

```bash
pnpm run verify:change
pnpm run verify:change:run
```

Before finalizing, complete every command listed under `pnpm run verify:change` required commands. `verify:change:run` remains the authoritative local terminal gate and may reuse valid receipts for the current tracked tree.

CI path:

- App Quality, OpenSpec, UI Smoke, Database Security, and Dependency Audit remain the PR merge protection layer.
- Expect.dev is not part of CI and must not be added as a blocking workflow during this pilot.
- CI semantics are unchanged by `verify:fast`.

Release path:

```bash
pnpm run verify:ship:local
pnpm ship --pr <number>
```

Use release gates only after the local change gate passes and release work is actually intended.

### When Not To Run The Full Suite

- Do not run `pnpm run test:ui:smoke` before `pnpm run verify:change:run` unless targeted smoke or the terminal gate proves the failure is browser-specific, or `verify:change` selects the full suite.
- Do not run `pnpm run verify:ship:local` as a coding-loop check; reserve it for pre-ship confidence.
- Do not run `pnpm ship` for local debugging.
- Do not rerun `verify:change:run` repeatedly while fixing a narrow lint, type, Vitest, UI smoke, or DB failure; rerun the narrow failing command first.
- Do not rely on `pnpm run qa:expect` for pass/fail validation until a future safe no-cookie run exits cleanly.

### Common Change Types

| Change type | Start with | Then run | Terminal gate |
|---|---|---|---|
| Docs or OpenSpec only | `pnpm run spec:validate` | `pnpm run verify:change` | `pnpm run verify:change:run` |
| TypeScript logic, scripts, API handlers, components | `pnpm run verify:fast` | `pnpm run test -- <focused-file-or-pattern>` | `pnpm run verify:change:run` |
| App Router page or smoke-tracked UI surface | `pnpm run verify:fast` | `pnpm run smoke:check`, then targeted UI smoke only when selected | `pnpm run verify:change:run` |
| UI smoke harness or route registry | `pnpm run smoke:check` | targeted/full UI smoke as selected by `verify:change` | `pnpm run verify:change:run` |
| Supabase schema, RLS, auth, admin, permissions, migrations | focused unit/API tests where available | `pnpm run db:security` and drift/manual steps when selected | `pnpm run verify:change:run` |
| Release readiness | `pnpm run verify:change:run` | `pnpm run verify:ship:local` | `pnpm ship --pr <number>` |

### Expect.dev Retest Condition

Retest `pnpm run qa:expect` only after one of these changes:

- `expect-cli` publishes a version newer than `0.1.3`
- Codex CLI is newer than `0.125.0`
- Expect.dev updates its bundled Codex ACP adapter

The retest must remain local-only, no-cookie by default, unauthenticated first, and non-mutating against production Supabase.

## Speed Triage

Local timing evidence in `.tmp/verify-cache/timings.jsonl` shows the slowest loops are:

1. `pnpm ship`
2. `pnpm run test:ui:smoke`
3. `pnpm run verify:ship:local`
4. `pnpm run verify:change:run`
5. `test:ui:smoke:targeted+full`
6. `pnpm run test:ui:smoke:targeted`
7. `pnpm run db:security`
8. `pnpm run verify:app`

Phase 1 low-risk changes:

- Add a local Expect.dev preflight alias.
- Document fast-to-slow command ordering.
- Keep targeted tests and `verify:change:run` authoritative.
- Avoid repeated full-suite reruns while debugging.

Phase 2 low-risk changes:

- Add `pnpm run verify:fast` as an advisory coding-loop alias.
- Document the command ladder and common change-type command choices.
- Keep `qa:expect` installed but blocked as pass/fail validation pending upstream completion fixes.

No Phase 1 changes:

- No Playwright suite rewrite.
- No test deletion.
- No weakened CI gates.
- No broad semantic changes to validation tooling.
- No complex sharding or parallelization infrastructure.

## Phase 2 Recommendations

- Review full UI smoke project grouping and bootstrap reuse for further safe runtime reduction.
- Add timing summaries for `verify:app` subtasks so lint, Vitest, and build bottlenecks can be separated.
- Consider a targeted unit/component helper only if repeated usage shows one stable pattern that is not already covered by `pnpm run test -- <file-or-pattern>`.
- Retest Expect.dev only after a new Expect.dev/Codex ACP/Codex CLI release changes the completion behavior.
