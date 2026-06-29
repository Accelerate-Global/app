## Why

The Supabase heartbeat route and Vercel Cron configuration can exist locally
without being deployed, which lets production keep serving an older build and
allows the Supabase project to pause again. Release Health needs to catch that
specific deployment/configuration gap after `main` deploys.

## What Changes

- Extend production Release Health to check the unauthenticated Supabase
  heartbeat endpoint.
- Treat HTTP 401 as the healthy unauthenticated state, proving the route exists
  and fails closed behind `CRON_SECRET`.
- Treat HTTP 404, 500, and 503 as actionable release-health failures with
  route-missing, secret-missing, and Supabase-unavailable guidance.

Non-goals:

- Do not change the heartbeat route query or cron schedule.
- Do not add a user-facing health page.
- Do not make Supabase account or billing changes.

## Capabilities

### New Capabilities

### Modified Capabilities
- `vercel-deployment-workflow`: Release Health verifies that the deployed
  production alias includes the Supabase heartbeat route and that it is
  protected by `CRON_SECRET`.

## Impact

- Affects release tooling in `scripts/lib/release.ts` and its tests.
- Affects production release behavior after merge to `main`.
- No UI smoke, database schema, or public API shape changes.
