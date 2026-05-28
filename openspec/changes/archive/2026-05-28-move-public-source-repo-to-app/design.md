## Context

`docs/release.md` and `openspec/specs/vercel-deployment-workflow/spec.md`
define merge-to-`main` as the production Vercel deployment path. The release
helper currently polls GitHub deployments through a hardcoded
`Accelerate-Global/online` REST path, which will be wrong after pushing the
clean source history to `Accelerate-Global/app`.

The Vercel project, Supabase project, Resend sender, and production domain are
runtime provider state and should be reused. The repo move is primarily a GitHub
source and Vercel Git-link change.

## Decisions

- Use `Accelerate-Global/app` as the canonical public source repository.
- Keep `Accelerate-Global/online` private and do not migrate historical PR refs,
  branches, releases, Actions runs, or artifacts.
- Keep the Vercel project name `online` and reconnect only its Git integration.
- Make release deployment polling use GitHub CLI placeholders
  `repos/{owner}/{repo}/...`, matching existing `gh api` usage in `ship`.
- Create the new GitHub repository private first for publication-safety
  verification, then switch it public before Vercel Git connection because the
  target Vercel Hobby project cannot connect private organization repositories.

## Risks

- If Vercel is not correctly reconnected, `Release Health` will wait for a
  GitHub deployment record that never appears.
- If the old repo is made public instead of using the new repo, GitHub-managed
  PR refs can expose historical identifiers.
- If only `origin` is changed locally without updating docs and release helper
  behavior, future `pnpm ship` runs may poll the wrong repository.

## Verification

- Unit tests prove release deployment polling uses current-repo placeholders.
- Provider checks prove `Accelerate-Global/app` owns the pushed clean `main`,
  Vercel links to that repo, and `data.accelerateglobal.org` remains healthy.
- Publication-safety scans run before the public visibility flip, and the first
  Git-backed Vercel deployment is verified after the repository is public and
  connected.
