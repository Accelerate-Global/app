# Supabase Heartbeat Cron

This app uses a daily Vercel Cron job to make three tiny, read-only Supabase
database requests for the deployed Free-plan project.

Supabase considers Free-plan projects inactive when they have too little user
database activity over seven days. Its [Project Pausing guidance](https://supabase.com/docs/guides/platform/free-project-pausing)
states that a few user database requests each day are typically enough. Pro is
the only plan-level guarantee against inactivity pausing, but this cron makes
three real app-owned database API reads per day without writing data or adding
another scheduler.

## Runtime Behavior

- Vercel invokes `GET /api/ops/supabase-heartbeat` from the production
  deployment.
- The route requires `Authorization: Bearer <CRON_SECRET>`.
- The route performs three sequential read-only queries:

  ```text
  field_definitions.select("id").limit(1)
  ```

- The route never inserts, updates, deletes, invites, uploads, publishes,
  revokes, or otherwise mutates production data.
- Supabase failures return HTTP 503, are logged through the repo's normalized
  error logger, and attempt one direct operational email through Resend; later
  heartbeat reads are not attempted after a failure.
- The fallback Resend call does not read or write Supabase, so it remains
  available when the database and primary Supabase Edge Function path are not.
- Fallback email uses one deterministic idempotency key per UTC day. Missing or
  failed Resend configuration is normalized and logged without changing the
  existing HTTP 503 response.
- Successful responses include `Cache-Control: no-store`.

## Vercel Setup

Set `CRON_SECRET` in the Vercel project environment variables before deploying
the cron configuration. Use a random production secret of at least 16
characters.

Also configure the server-only Resend fallback variables documented in
`docs/operations/operational-alert-email.md`:

- `RESEND_OPERATIONAL_API_KEY`
- `OPERATIONAL_ALERT_FROM`
- `OPERATIONAL_ALERT_RECIPIENT`
- `OPERATIONAL_ALERT_DETAILS_URL` (optional)

The tracked `vercel.json` schedules the heartbeat daily:

```json
{
  "path": "/api/ops/supabase-heartbeat",
  "schedule": "0 16 * * *"
}
```

Vercel schedules cron expressions in UTC. On Hobby, daily cron invocations can
run at any point within the selected hour.

## Manual Verification

After deployment, verify the cron from Vercel logs or by making an authenticated
request against production:

```bash
curl -i \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://data.accelerateglobal.org/api/ops/supabase-heartbeat
```

Expected success:

```json
{"ok":true}
```

If the route returns `401`, the request did not use the configured cron secret.
If it returns `500`, `CRON_SECRET` is missing from the runtime. If it returns
`503`, inspect Vercel logs for the normalized Supabase error and any normalized
fallback-email delivery error. Never include raw provider responses in those logs.
