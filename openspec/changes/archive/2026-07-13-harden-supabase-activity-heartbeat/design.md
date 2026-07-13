## Context

The deployed daily Vercel Cron route is authenticated, reaches Supabase, and
returns HTTP 200, but Supabase still warned that the Free-plan project has too
little activity. Supabase's Project Pausing guidance specifies that a few user
database requests each day are typically enough. The existing route makes one
PostgREST read, which is below that documented guidance.

## Goals / Non-Goals

**Goals:**

- Generate a few distinct Supabase database API requests each day from the
  existing authenticated Vercel Cron invocation.
- Keep every request read-only, bounded, and directed at the same stable table.
- Preserve the existing 401, 500, 503, no-store, and normalized-error behavior.

**Non-Goals:**

- Creating data, adding tables, migrations, `pg_cron`, or another scheduler.
- Simulating browser traffic, accessing user data, or hiding activity from
  Supabase.
- Guaranteeing immunity from plan or policy changes unrelated to inactivity.

## Decisions

### Make three sequential read-only requests in the existing route

The route will execute `field_definitions.select("id").limit(1)` three times
after bearer authorization. Each Supabase client operation is a separate API
request, satisfying the documented "few user requests" guidance while using a
negligible amount of compute and no writes.

Three is deliberate: one was demonstrably insufficient, and three is the
smallest unambiguous interpretation of "a few." Sequential execution makes
each request explicit and lets the route stop immediately on the first error.

Alternatives rejected:

- Two Vercel cron entries: uses the remaining Hobby cron slot and complicates
  monitoring without improving the data-access contract.
- Writes or a synthetic heartbeat table: risks production-data mutation and
  creates schema maintenance solely for an operational signal.
- `pg_cron`: adds database-side scheduling and state for a task already handled
  by Vercel.

### Keep the existing stable-table and failure contract

The `field_definitions` primary-key read remains bounded to one column and one
row. Authorization is checked before a client is created. Any failed request
returns the current normalized 503 result, so a partial heartbeat never reports
success.

### Document the operational basis and validate the request count

The operations document will cite Supabase's Project Pausing guidance and
describe the exact three-request behavior. The route test will assert all three
read-only calls occur on success and that an error stops subsequent requests.

## Risks / Trade-offs

- Supabase can change its inactivity classifier → The document records the
  provider guidance and the route remains observable through Vercel logs.
- A provider failure could leave only partial daily activity → Fail-fast 503 and
  normalized logs make that visible to the existing release and Vercel checks.
- Three requests are more work than one → Each is a one-row, one-column read
  once per day, far below meaningful traffic or billing thresholds.

## Migration Plan

1. Deploy the route and test/documentation changes through the normal PR flow.
2. Confirm the unauthenticated production route remains 401.
3. Trigger the registered Vercel Cron once and confirm HTTP 200 in logs.
4. If a regression appears, revert the deployment; the previous one-request
   route remains data-safe but is not sufficient for the documented threshold.
