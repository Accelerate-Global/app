## Why

The Supabase project used by the Vercel-hosted app was flagged for low Free-plan
activity, which can pause the project and make the production app unavailable.
The repo needs a zero-cost, low-impact production heartbeat that creates real
Supabase activity without mutating user data or adding another scheduler.

## What Changes

- Add a production Vercel Cron job that invokes a protected App Router API
  route once per day.
- Add a server-only heartbeat route that requires `CRON_SECRET` and performs one
  tiny read-only query against an existing Supabase table.
- Return clear success, unauthorized, missing-configuration, and upstream-failure
  responses without exposing provider secrets or raw provider error payloads.
- Document the Vercel `CRON_SECRET` setup and the heartbeat's non-mutating
  behavior for future maintainers.

Non-goals:

- Do not upgrade Supabase billing or otherwise change account settings.
- Do not add new database schema, write heartbeat rows, or mutate production
  data.
- Do not make any user-facing page or UI smoke route changes.

## Capabilities

### New Capabilities
- `supabase-heartbeat`: Production-safe Supabase keep-alive heartbeat behavior
  for the deployed app.

### Modified Capabilities
- `vercel-deployment-workflow`: Production deployments include the daily Vercel
  Cron configuration that invokes the heartbeat route.
- `api-route-security`: The documented route-guard exemption list includes the
  cron heartbeat route because it uses Vercel bearer authentication rather than
  user identity.

## Impact

- Affects Supabase and Vercel deployment behavior.
- Adds a new `GET /api/ops/supabase-heartbeat` API contract for Vercel Cron.
- Uses existing Supabase server/admin utilities in `src/lib/supabase/admin.ts`
  and safe error logging in `src/lib/error-logging.ts`.
- Adds or updates `vercel.json`, `.env.example`, and maintainer documentation.
- Adds focused route tests; no UI smoke coverage is required because no
  `src/app/**/page.tsx` or shared UI primitive changes are planned.
