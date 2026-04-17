# Release Runbook

This repo now treats a merge to `main` as the production deployment trigger.
Do not run `vercel --prod` as part of the normal release flow. Reserve manual
Vercel production deploys for emergency recovery only.

## Standard Flow

1. Confirm the PR already passed the diff-aware local gate before review or ship:

   ```bash
   pnpm run verify:change:run
   ```

2. Run the single pre-ship local gate:

   ```bash
   pnpm run verify:ship:local
   ```

   `pnpm verify:release` remains as a temporary deprecated alias.
   Run this from a clean, already-committed PR branch. `pnpm ship` is not a
   substitute for branch creation, staging, or commit authoring.

3. If the release includes tracked Supabase migrations, apply them to the linked
   remote project explicitly before merge:

   ```bash
   pnpm db:push:remote
   ```

4. Ensure the remote field-source registry is seeded from the checked-in
   Aggregate 1 mapping CSV:

   ```bash
   pnpm field-sources:seed:remote
   ```

5. Ship the reviewed PR:

   ```bash
   pnpm ship --pr <number>
   ```

`pnpm ship` does the following:

- refuses to run with a dirty worktree
- fails early if the linked remote database is missing tracked migrations
- relies on release-critical CLI scripts that use the shared `@/db` singleton
  to close that client before exit, so control returns cleanly to the ship
  process after remote checks such as `field-sources:seed:remote`
- waits for the PR `App Quality`, `UI Smoke`, and `Database Security` checks
- emits progress updates while waiting on remote checks, merge state, release
  health, and production deployment state
- merges the PR to `main`
- switches the local checkout back to `main`, pulls `--ff-only`, deletes the
  merged branch locally when safe, and prunes remote refs
- waits for the `main` branch `Release Health` workflow
- waits for the GitHub-backed Vercel production deployment
- verifies that [data.accelerateglobal.org](https://data.accelerateglobal.org)
  points at the same Vercel deployment as the git-based production deploy
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

The repo now publishes `App Quality`, `UI Smoke`, `Database Security`, and
`Release Health` workflow signals. GitHub branch-protection/ruleset enforcement
is not available for this private repository on the current plan, so `pnpm ship`
serves as the practical merge gate until repository-level required checks can be
enabled.
