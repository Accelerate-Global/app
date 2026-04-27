# Contributing

## Change Workflow

1. Start from a clean worktree when possible.
2. Read the relevant code and docs before making claims.
3. Run `pnpm run verify:change` before editing.
4. Run `pnpm run task:kickoff -- --scope <owned-path-or-glob>` for UI, admin, DB, or verification-tooling work.
5. Keep edits scoped to the requested behavior.
6. Add or update tests when touched code already has direct same-stem tests, when behavior changes, or when verification reports a test-delta requirement.
7. Run `pnpm run verify:change:run` before finalizing tracked repo changes.

## OpenSpec Policy

Use OpenSpec when changing observable behavior, workflows, public APIs, data
model behavior, auth/session/permissions, security/privacy posture, Supabase
behavior, Vercel deployment behavior, or user-facing outcomes.

Keep current-state documentation in `docs/`. Keep durable future behavior
contracts in `openspec/specs/`, created or updated only as related behavior is
touched.

Default flow for meaningful behavior changes when OPSX commands are configured:

```bash
/opsx:propose "short change intent"
/opsx:apply
/opsx:verify
/opsx:archive
```

Repo-owned OpenSpec state is the tracked `openspec/` directory. Generated Codex
skills under `.codex/` and global prompts under `~/.codex/prompts/opsx-*.md`
are machine-local tooling, not portable repo behavior.

## Tests And Gates

- App quality: `pnpm run verify:app`.
- TypeScript: `pnpm run typecheck`.
- UI smoke contract: `pnpm run smoke:check`.
- UI smoke browser suite: `pnpm run test:ui:smoke` or `pnpm run test:ui:smoke:targeted` when required by `verify:change`.
- Database security: `pnpm run db:security`.
- Release readiness: `pnpm run verify:ship:local`.

Follow `docs/testing/verification-triage.md` when a command fails. Classify the
failure as `environment`, `test gap`, `contract / harness`, or `product` before
rerunning a narrow command.

## UI Changes

Every `src/app/**/page.tsx` page must have an entry in
`tests/ui/route-registry.ts` and render literal smoke markers. New browser-smoked
dialogs, sheets, menus, tooltips, and popovers must expose matching smoke trigger
and surface attributes. New shared primitives under `src/components/ui` need a
colocated `*.smoke.tsx` fixture.

## Database And Supabase Changes

Do not use `drizzle-kit push` against this project database. Commit schema
changes as SQL migrations under `supabase/migrations` and keep RLS/security
tests current. Provider setup such as first-admin bootstrap remains an explicit
environment operation unless a tracked migration or runbook changes it.

## Release

The standard release path is documented in `docs/release.md`. The repo treats a
merge to `main` as the production deployment trigger through Vercel. `pnpm ship`
waits for App Quality, UI Smoke, Database Security, Dependency Audit, and
Release Health signals.
