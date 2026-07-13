## Why

Supabase has again classified the Free-plan `online` project as inactive even
though the deployed Vercel Cron route succeeds. Supabase's current Project
Pausing guidance says a few user database requests each day are typically
enough; the current implementation makes only one request per day.

## What Changes

- Make each authorized daily heartbeat perform three distinct, sequential,
  read-only Supabase API requests against the existing stable table.
- Preserve fail-closed cron authentication, no-cache responses, normalized
  provider error logging, and the no-write production-data guarantee.
- Document the documented activity threshold and the exact request behavior so
  maintainers do not reduce the heartbeat back below the intended level.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `supabase-heartbeat`: An authorized heartbeat must make a few separate
  read-only database requests each day rather than a single request.

## Impact

- Updates the protected Next.js route and its focused Vitest coverage at
  `src/app/api/ops/supabase-heartbeat/`.
- Updates `docs/operations/supabase-heartbeat.md` and the durable
  `supabase-heartbeat` OpenSpec.
- Keeps the existing daily Vercel Cron and `CRON_SECRET` configuration; no
  schema, migration, user-facing UI, or production-data write is introduced.
