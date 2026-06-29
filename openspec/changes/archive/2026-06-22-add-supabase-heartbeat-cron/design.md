## Context

Supabase Free projects can be paused for low activity, and the current project
was warned about insufficient activity. The app is deployed on Vercel, already
has server-side Supabase configuration, and can use Vercel Cron without adding a
new service. Vercel Cron invokes production deployment paths with GET requests
and can include an `Authorization: Bearer <CRON_SECRET>` header when the project
has a `CRON_SECRET` environment variable.

The heartbeat is production-adjacent because it talks to the deployed Supabase
project, but it does not need database writes, migrations, browser UI, user
sessions, or admin role checks. It only needs to prove the Supabase project is
reachable by performing a tiny read-only operation against an existing stable
table.

## Goals / Non-Goals

**Goals:**

- Keep the Supabase project active with one daily, zero-cost Vercel Cron
  invocation.
- Use a read-only Supabase query that does not modify production data.
- Require `CRON_SECRET` so the endpoint cannot be used as an unauthenticated
  public health probe.
- Return clear status codes for unauthorized, misconfigured, successful, and
  Supabase-failed states.
- Cover the route with focused unit tests and document Vercel configuration.

**Non-Goals:**

- No Supabase billing, organization, or account changes.
- No new database schema, migrations, heartbeat rows, or write operations.
- No user-facing dashboard or UI smoke changes.
- No additional scheduler such as GitHub Actions, external uptime checks, or
  Supabase-internal cron.

## Decisions

1. Use Vercel Cron instead of GitHub Actions or an external uptime service.
   Vercel already owns the production deployment and app environment, so it can
   call the app route without duplicating Supabase secrets elsewhere. GitHub
   Actions was considered, but it would create a second scheduler and secret
   store. Public uptime pings were considered, but a static page hit might not
   create Supabase activity.

2. Use an App Router API route at `/api/ops/supabase-heartbeat`.
   The route is explicit operational surface area and avoids colliding with
   user/admin API routes. It can be called locally with a bearer token for
   manual verification, and Vercel Cron can target it directly from
   `vercel.json`. Because the route is authenticated by Vercel's bearer secret
   instead of a user session, it is added to the documented route-guard sweep
   exemption list.

3. Require `CRON_SECRET` and fail closed when it is missing.
   Vercel recommends `CRON_SECRET` for cron authentication and sends it as a
   bearer authorization header. Treating a missing secret as server
   misconfiguration prevents accidentally publishing a callable health probe.

4. Perform one read-only query through the existing Supabase admin helper.
   The service-role client is already server-only and bypasses RLS, which makes
   the heartbeat independent of user sessions and public table policies. The
   query selects a single `id` from the existing `field_definitions` table,
   minimizing query cost and avoiding writes. Using the publishable/anon key was
   considered, but that would make the heartbeat depend on exposed-schema RLS
   behavior rather than the app's server-side operational credentials.

5. Log normalized error details only.
   Supabase failures are reported to callers as a generic 503 payload, while
   server logs use the existing normalized error logger so raw provider objects
   and secrets are not exposed.

## Risks / Trade-offs

- Supabase does not publicly define the exact activity threshold beyond the
  Free-plan low-activity pause policy -> Use a real database read instead of a
  static app ping, and keep the official Pro upgrade as the only contractual
  guarantee.
- Vercel Hobby cron timing can drift within the selected hour -> Daily cadence
  is still far inside Supabase's seven-day low-activity window.
- Vercel may deliver duplicate cron invocations -> The operation is idempotent
  and read-only, so duplicates do not change data.
- The chosen table could be renamed in future schema work -> Tests assert the
  selected table, and documentation explains the table must remain stable or be
  updated with the heartbeat.
- A missing Vercel `CRON_SECRET` would cause production cron failures -> The
  route returns 500 for missing configuration, and docs call out the required
  environment variable before deploy.

## Migration Plan

1. Add the heartbeat route and unit tests.
2. Add `vercel.json` with a daily UTC cron schedule.
3. Document `CRON_SECRET` in `.env.example` and operations docs.
4. Deploy through the normal Vercel production path after local verification.
5. Rollback by removing the `crons` entry or reverting the route; no database
   data or schema rollback is needed.

## Open Questions

- None.
