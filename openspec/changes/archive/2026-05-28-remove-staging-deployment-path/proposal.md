## Why

The Vercel project still has a stale `staging` custom environment from the prior `accelerate-core`/`preview` branch workflow, while the current repo release path already treats `main` as the production deployment trigger. Removing that provider state makes the deployment workflow match the repo docs and reduces the chance of accidentally using an unsupported staging target.

## What Changes

- Remove the Vercel `staging` custom environment for the `online` project.
- Change the Vercel ignored-build-step policy so only the `main` branch is allowed to build automatically.
- Document that this repo has no supported staging promotion path; PR checks remain the validation layer before production.
- Preserve GitHub PR checks, `pnpm ship --pr`, production branch `main`, and `data.accelerateglobal.org`.

## Capabilities

### New Capabilities

- `vercel-deployment-workflow`: Defines the supported Vercel deployment path for this repo, including the absence of a staging target.

### Modified Capabilities

- None.

## Impact

- Affects Vercel deployment behavior and repo release documentation.
- Does not affect auth, admin permissions, data integrity, Supabase schema, API contracts, or UI smoke coverage.
- Current release behavior is grounded in `docs/release.md`, `scripts/ship.ts`, and `.github/workflows/release-health.yml`.
