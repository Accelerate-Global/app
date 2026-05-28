# Release Runbook

This repo now treats a merge to `main` as the production deployment trigger.
Do not run `vercel --prod` as part of the normal release flow. Reserve manual
Vercel production deploys for emergency recovery only.

The canonical public source repository is `Accelerate-Global/app`. The former
`Accelerate-Global/online` repository is private historical archive state and is
not part of the supported public release path.

The repo does not maintain a supported Vercel staging environment or staging
promotion path. Pull requests are validated by local and GitHub checks, then
merged to `main` for the production Vercel deployment.

## Standard Flow

1. Confirm the PR already passed the diff-aware local gate before review or ship:

   ```bash
   pnpm run verify:change:run
   ```

2. Confirm OpenSpec has no active unarchived changes:

   ```bash
   pnpm run spec:check-archive
   ```

   If this fails, archive the completed change before shipping:

   ```bash
   pnpm run spec:archive -- <change-id>
   ```

3. Run the single pre-ship local gate:

   ```bash
   pnpm run verify:ship:local
   ```

   `pnpm verify:release` remains as a temporary deprecated alias.
   Run this from a clean, already-committed PR branch. `pnpm ship` is not a
   substitute for branch creation, staging, or commit authoring.

4. If the release includes tracked Supabase migrations, apply them to the linked
   remote project explicitly before merge:

   ```bash
   pnpm db:push:remote
   ```

5. Ship the reviewed PR:

   ```bash
   pnpm ship --pr <number>
   ```

`pnpm ship` does the following:

- refuses to run with a dirty worktree
- blocks ship when active OpenSpec changes remain unarchived
- fails early if the linked remote database is missing tracked migrations
- inspects the PR file list and only seeds the remote field-source registry
  when the diff touches checked-in field-source seed inputs
- relies on release-critical CLI scripts that use the shared `@/db` singleton
  to close that client before exit, so control returns cleanly to the ship
  process after remote checks such as `field-sources:seed:remote`
- waits for the PR `App Quality`, `OpenSpec`, `UI Smoke`, `Database Security`, and
  `Dependency Audit` checks
- emits progress updates while waiting on remote checks, merge state, and
  release health
- merges the PR to `main`
- switches the local checkout back to `main`, pulls `--ff-only`, deletes the
  merged branch locally when safe, and prunes remote refs
- waits for the `main` branch `Release Health` workflow, which in turn waits
  for the current repository's GitHub-backed Vercel production deployment and verifies the
  [data.accelerateglobal.org](https://data.accelerateglobal.org) production
  alias
- does not deploy or promote through a Vercel staging target
- fails fast if a `gh`, `git`, or release-critical `pnpm` step stops making
  progress because it is waiting on interactive input

## Fallbacks

- If Docker is unavailable locally, use `pnpm db:security:remote` instead of
  the local DB security gate.
- If GitHub CLI authentication is missing, complete `gh auth login` before
  running `pnpm ship`.
- If `pnpm ship` is interrupted or a remote wait fails mid-run, re-run
  `pnpm ship --pr <number>` first. The command is expected to resume from the
  current PR state and continue the post-merge checks when the PR is already
  merged.
- If the linked Supabase migration check fails, run `pnpm db:push:remote`
  explicitly and then re-run `pnpm ship`.
- If the production alias is unhealthy after merge, inspect the `Release Health`
  GitHub workflow first. Use a manual Vercel production deploy only if the
  git-based deployment path is unavailable.

## GitHub Identity

Commits pushed through GitHub are more reliable when the repo-local author uses
the GitHub noreply address for the authenticated account:

```bash
git config user.name "ricky"
git config user.email "116130409+II-ricky-bobby-II@users.noreply.github.com"
```

## Required Checks

The repo now publishes `App Quality`, `OpenSpec`, `UI Smoke`, `Database Security`,
`Dependency Audit`, and `Release Health` workflow signals. `pnpm ship` waits
for the first five checks before merge, but GitHub UI merges can still bypass
that CLI gate unless repository settings enforce required checks.

Manual GitHub follow-up:

1. Add a branch protection rule or ruleset for `main`.
2. Require `App Quality`, `OpenSpec`, `UI Smoke`, `Database Security`, and
   `Dependency Audit` before merge.
3. Restrict direct pushes and manual bypasses to the smallest practical admin
   set.

Until that repository-level enforcement exists, treat `pnpm ship` as the
required release path rather than a convenience wrapper.
