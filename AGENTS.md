## Docker / Supabase cleanup rules

When working in this repo, agents must treat Docker state as temporary unless the user explicitly asks to keep services running.

### Required behavior
- If the agent starts local Docker services for this repo, it must stop them before finishing unless the user explicitly asks to keep them running.
- Prefer repo-scoped shutdown commands:
  - `docker compose down --remove-orphans`
  - or `supabase stop`
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
Before finishing, the agent must state:
- whether it started Docker or Supabase services
- whether those services were stopped
- whether cleanup commands were run
- whether any local persistent data was preserved

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
- Treat the repo definition of done as blocking policy:
  - if a changed repo file already has a direct same-stem repo-local test, at least one mapped test file must be created or updated in the same diff
  - every command listed under `pnpm run verify:change` “Required commands” must run and pass locally before the agent finalizes
  - `No tests found`, skipped required checks, missing test deltas, and failing required checks are blockers
  - if repo-owned verification tooling fails, the agent must fix that tooling failure instead of stopping at “implementation complete”
- For UI, DB, or migration tasks, state a short verification intent before coding:
  - changed area
  - required commands from `pnpm run verify:change`
  - targeted smoke subset from `pnpm run verify:change`
- Run `pnpm run verify:change:run` before finalizing when repo-tracked code, scripts, config, or tests changed.
- If you add or edit a page, shared UI primitive, smoke surface, Supabase migration, or DB-affecting code path, satisfy the listed repo contracts during implementation, not at the end.
- Use `pnpm run test:ui:smoke:targeted` as the first browser gate for impacted routes and journeys.
- Before finalizing or attempting `ship` / release work, rerun `pnpm run verify:change` and complete every command listed under “Required commands”.
- Keep `pnpm run test:ui:smoke` as the final merge or release gate after the targeted subset is green.
- Use [/Users/blake/Documents/accelerate-global/online/config/change-impact.ts](/Users/blake/Documents/accelerate-global/online/config/change-impact.ts) as the canonical rule set for impacted domains and verification commands.
- Use [/Users/blake/Documents/accelerate-global/online/docs/testing/ui-smoke.md](/Users/blake/Documents/accelerate-global/online/docs/testing/ui-smoke.md) for the detailed smoke contract and examples.
