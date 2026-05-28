## Why

The existing private GitHub repository retains provider-managed pull-request refs
that should not be exposed publicly. Publishing a fresh repository from the
clean rewritten `main` branch preserves public-source safety while keeping the
current Vercel, Supabase, Resend, and production-domain runtime stable.

## What Changes

- Create `Accelerate-Global/app` as the canonical public source repository,
  pushed from the clean rewritten `main` branch only.
- Keep `Accelerate-Global/online` private as historical archive state.
- Reconnect the existing Vercel project `online` to the new GitHub repository
  while preserving the production domain and provider environment variables.
- Make Release Health deployment polling use the current GitHub repository
  instead of a hardcoded historical owner/name.
- Document the repo move, provider boundaries, and no-downtime verification
  path.

## Capabilities

### New Capabilities

### Modified Capabilities

- `vercel-deployment-workflow`: Production deployments remain Vercel `main`
  deployments, but the canonical GitHub source repository changes to
  `Accelerate-Global/app` and release-health polling must target the current
  repository.

## Impact

- Affects Vercel deployment workflow, GitHub release automation, repo release
  documentation, and provider runbooks.
- Does not change Supabase schema, auth provider, storage buckets, Resend/DNS
  settings, API contracts, admin permissions, or UI smoke coverage.
