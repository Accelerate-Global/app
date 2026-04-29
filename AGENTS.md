## Docker / Supabase cleanup rules

When working in this repo, agents must treat Docker state as temporary unless the user explicitly asks to keep services running.

### Required behavior
- If the agent starts local Docker services for this repo, it must stop them before finishing unless the user explicitly asks to keep them running.
- Prefer repo-scoped shutdown commands:
  - `docker compose down --remove-orphans`
  - or `supabase stop`
- If required verification is blocked by this repo's existing local Supabase stack or occupied local Supabase ports, the agent must take initiative to stop that repo-local stack and continue the verification flow.
- When the blocked verification expects a clean local database state, the agent may reset or restart the repo-local Supabase stack as part of the repo's normal verification commands without waiting for extra user confirmation.
- After shutdown, agents should reclaim transient Docker cache with:
  - `docker builder prune -af`
- Agents may run:
  - `docker image prune -a -f`
  - `docker container prune -f`
  when cleanup is appropriate and no repo services are meant to remain running.

### Prohibited behavior
- Do not run `docker system prune -a --volumes`.
- Do not run `docker volume prune`.
- Do not remove named Docker volumes unless the user explicitly requests a full local reset.
- Do not delete Docker data outside the current repo’s scope unless explicitly instructed.

### End-of-task check
Before finishing, if the run involved repo-local Docker or Supabase activity, the agent must state:
- whether it started Docker or Supabase services
- whether those services were stopped
- whether cleanup commands were run
- whether any local persistent data was preserved

### Final response footer
Before finishing, the agent should use short footer sections instead of a prose-style operational summary, but only include sections that are relevant to the work performed in that run.

Use this footer structure:

#### Verification
- Use short status bullets only.
- Format each bullet like `check-name: passed`, `check-name: failed`, or `check-name: not run`.
- Include only the relevant verification commands or checks for the work that was performed.
- Separate `failed` from `not run`; do not collapse them together.
- Omit this section if no meaningful verification was run or discussed.

#### Open Items
- Include only unresolved blockers, failed checks, or intentionally unfinished work.
- Keep each bullet brief and outcome-focused.
- Omit this section entirely if there is nothing unresolved.

#### Next Step
- Optional.
- Include only when there is one obvious immediate follow-up for the user.
- Keep it to a single short bullet.

#### Docker / Supabase
- Keep this section last.
- Include this section only when the run involved repo-local Docker or Supabase services, cleanup, or related blockers.
- Use short bullets for:
  - `Started: yes` or `Started: no`
  - `Stopped: yes` or `Stopped: no`
  - `Cleanup: yes` or `Cleanup: no`
  - `Persistent data: preserved` or `Persistent data: not preserved`

# UI Smoke Contract

Treat the UI smoke system as mandatory repo policy.

- Every `src/app/**/page.tsx` needs an explicit entry in `/Users/blake/Documents/accelerate-global/online/tests/ui/route-registry.ts`.
- Rendered pages must expose a literal `data-smoke-page="..."` marker.
- New sheets, dialogs, menus, tooltips, and popovers that should be browser-smoked must expose matching literal `data-smoke-trigger`, `data-smoke-surface`, and `data-smoke-ready` attributes.
- Every new `src/components/ui/*.tsx` shared primitive needs a colocated `*.smoke.tsx` fixture.
- Run `pnpm run smoke:check` after UI changes. It regenerates the shared fixture manifest and fails on missing coverage.
- In Codex desktop on macOS, do not attempt Playwright smoke commands inside the sandbox first. Request escalated execution immediately for:
  - `pnpm run test:ui:smoke`
  - `pnpm run test:ui:smoke:targeted`
  - `pnpm run test:ui:smoke:headed`
  - `pnpm run verify:change:run` when it will invoke UI smoke
  Chromium launch in the sandbox fails with macOS Mach port permission errors, so the first attempt should be outside the sandbox.

Full rules and examples live in [/Users/blake/Documents/accelerate-global/online/docs/testing/ui-smoke.md](/Users/blake/Documents/accelerate-global/online/docs/testing/ui-smoke.md).

# Change Planning

Treat `pnpm run verify:change` as the local planning gate for repo-tracked edits.

- After initial exploration, run `pnpm run verify:change` before writing code.
- For AI-agent UI, admin, DB, and verification-tooling tasks, run `pnpm run task:kickoff -- --scope <owned-path-or-glob>` right after exploration so the kickoff brief captures owned paths, unrelated dirty paths, verification lane, local Supabase need, required commands, targeted smoke subset, and the terminal gate.
- Treat the repo definition of done as blocking policy:
  - if a changed repo file already has a direct same-stem repo-local test, at least one mapped test file must be created or updated in the same diff
  - every command listed under `pnpm run verify:change` “Required commands” must run and pass locally before the agent finalizes
  - `No tests found`, skipped required checks, missing test deltas, and failing required checks are blockers
  - if repo-owned verification tooling fails, the agent must fix that tooling failure instead of stopping at “implementation complete”
- For UI, DB, migration, or verification-tooling tasks, state a short verification intent before coding:
  - changed area
  - required commands from `pnpm run verify:change`
  - targeted smoke subset from `pnpm run verify:change`
  - whether local Supabase is needed
- Prefer the thin-slice loop while coding:
  - `pnpm run verify:fast` for early TypeScript, lint, and Vitest feedback before slower gates
  - direct tests for touched units or components first
  - `pnpm run smoke:check` when UI contracts changed
  - `pnpm run test:ui:smoke:targeted` only when a browser-specific issue needs debugging
  - `pnpm run verify:change:run` as the single terminal gate for the candidate tracked tree
- Run `pnpm run verify:change:run` before finalizing when repo-tracked code, scripts, config, or tests changed.
- If you add or edit a page, shared UI primitive, smoke surface, Supabase migration, or DB-affecting code path, satisfy the listed repo contracts during implementation, not at the end.
- Before finalizing or attempting `ship` / release work, rerun `pnpm run verify:change` and complete every command listed under “Required commands”.
- Use `pnpm run verify:ship:local` as the single pre-ship local gate. It reuses prior passes on the same tracked tree and runs any remaining release-only smoke work before `pnpm ship --pr <number>`.
- Use standalone `pnpm run test:ui:smoke:targeted` and `pnpm run test:ui:smoke` only for focused debugging, ad hoc verification, or when `pnpm run verify:change` explicitly requires them.
- Do not run `pnpm run test:ui:smoke` manually before `pnpm run verify:change:run` unless targeted smoke or the terminal gate already proved the failure is browser-specific.
- Classify every failed verification rerun as `environment`, `test gap`, `contract / harness`, or `product` before rerunning the narrow failing command and returning to `pnpm run verify:change:run`.
- If `pnpm run test:ui:smoke`, `pnpm run db:security`, or `pnpm run verify:change:run` is blocked by an already-running repo-local Supabase stack, stop or reset that stack first and then continue the required command instead of stopping to ask.
- Use [/Users/blake/Documents/accelerate-global/online/config/change-impact.ts](/Users/blake/Documents/accelerate-global/online/config/change-impact.ts) as the canonical rule set for impacted domains and verification commands.
- Use [/Users/blake/Documents/accelerate-global/online/docs/testing/verification-first-delivery.md](/Users/blake/Documents/accelerate-global/online/docs/testing/verification-first-delivery.md) as the default repo workflow for verification-first delivery.
- Use [/Users/blake/Documents/accelerate-global/online/docs/testing/ui-smoke.md](/Users/blake/Documents/accelerate-global/online/docs/testing/ui-smoke.md) for the detailed smoke contract and examples.
- Use [/Users/blake/Documents/accelerate-global/online/docs/testing/verification-triage.md](/Users/blake/Documents/accelerate-global/online/docs/testing/verification-triage.md) for the fastest next step when verification fails.

# Expect.dev Local Preflight

Treat Expect.dev as an optional local-only preflight layer, not a durable test gate.

- As of Phase 2, Expect.dev is blocked as reliable pass/fail validation by an upstream run-completion timeout. Do not rely on `pnpm run qa:expect` until a future safe no-cookie unauthenticated retest exits cleanly.
- Use `pnpm run qa:expect` only for local changed-area browser QA before targeted persistent tests and before `pnpm run verify:change:run`.
- Do not add Expect.dev to GitHub Actions, `pnpm ship`, `verify:change:run`, or required CI gates during the local pilot.
- The wrapper defaults to `--no-cookies` because the connected Supabase project is production.
- Prefer unauthenticated checks first. Use `EXPECT_USE_COOKIES=1` only when the user explicitly approves read-only authenticated checks.
- Do not use Expect.dev to create, update, delete, invite, publish, revoke, reset passwords, change permissions, or otherwise mutate production data.
- Do not commit Expect.dev cookies, storage state, browser profiles, traces, screenshots, videos, downloads, local auth files, or logs that expose production data.
- Promote an Expect.dev finding into a persistent repo test only when the bug is important, deterministic, and likely to recur.
- See [/Users/blake/Documents/accelerate-global/online/docs/testing/TESTING_STRATEGY.md](/Users/blake/Documents/accelerate-global/online/docs/testing/TESTING_STRATEGY.md) for the full methodology and safety policy.

# OpenSpec

OpenSpec is initialized in `/Users/blake/Documents/accelerate-global/online/openspec` for durable behavior-change planning.

- OpenSpec is required for repo-tracked work. At minimum, every tracked change must pass `pnpm run spec:validate`.
- Use an OpenSpec change for changes to observable behavior, workflows, public APIs, data model behavior, auth/session/permissions, security/privacy posture, Supabase behavior, Vercel deployment behavior, user-facing outcomes, or repo workflow policy.
- Keep current-state orientation in `/Users/blake/Documents/accelerate-global/online/docs`; do not backfill broad baseline specs for untouched legacy behavior.
- Use the spec-as-you-touch model: create or update specs only when related behavior is changed.
- Prefer `/opsx:propose`, `/opsx:apply`, `/opsx:verify`, and `/opsx:archive` for meaningful behavior changes when those commands are available.
- If a plan clearly requires OpenSpec and no active change exists, stop before implementation and provide the exact `/opsx:propose` prompt unless the user explicitly asks to create the change directly.
- Repo-owned OpenSpec state lives under `/Users/blake/Documents/accelerate-global/online/openspec`; generated `.codex` skills and `~/.codex/prompts/opsx-*.md` prompts are machine-local developer tooling, not portable repo state.
- Keep OpenSpec artifacts grounded in actual repo files, commands, tests, and provider boundaries.
- Archive an OpenSpec change after implementation and required repo verification have passed, before `pnpm run verify:ship:local` or `pnpm ship`.
- Do not run `pnpm ship` with active unarchived OpenSpec changes under `openspec/changes/*`.

# Security Remediation Invariants

- Mutating `/api/**` requests and `POST /auth/sign-out` are same-origin guarded in `/Users/blake/Documents/accelerate-global/online/src/proxy.ts` via `/Users/blake/Documents/accelerate-global/online/src/lib/request-security.ts`. Keep that guard centralized unless a route needs a documented exception.
- Repo-owned browser hardening headers and CSP are defined in `/Users/blake/Documents/accelerate-global/online/next.config.ts` via `/Users/blake/Documents/accelerate-global/online/src/lib/security-headers.ts`.
- Provider-facing auth, storage, and admin code should log normalized error details through `/Users/blake/Documents/accelerate-global/online/src/lib/error-logging.ts`, not raw provider objects.
- GitHub workflows in `/Users/blake/Documents/accelerate-global/online/.github/workflows` are pinned to full SHAs, and `OpenSpec` plus `Dependency Audit` are part of the release gate that `pnpm ship` waits on.
- Runtime admin access comes from `auth.users.raw_app_meta_data.workspace_role`. First-admin bootstrap remains a manual environment/provider concern and must stay documented as such.
