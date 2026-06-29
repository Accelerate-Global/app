# Supabase Heartbeat Cron

This app uses a daily Vercel Cron job to create a tiny, read-only Supabase
activity signal for the deployed Free-plan project.

Supabase may pause Free-plan applications that show low activity during a
seven-day period. Pro is the only plan-level guarantee against inactivity
pausing, but this cron gives the Free-plan project one real app-owned Supabase
read per day without writing data or adding another scheduler.

## Runtime Behavior

- Vercel invokes `GET /api/ops/supabase-heartbeat` from the production
  deployment.
- The route requires `Authorization: Bearer <CRON_SECRET>`.
- The route performs one read-only query:

  ```text
  field_definitions.select("id").limit(1)
  ```

- The route never inserts, updates, deletes, invites, uploads, publishes,
  revokes, or otherwise mutates production data.
- Supabase failures return HTTP 503 and are logged through the repo's normalized
  error logger.
- Successful responses include `Cache-Control: no-store`.

## Vercel Setup

Set `CRON_SECRET` in the Vercel project environment variables before deploying
the cron configuration. Use a random production secret of at least 16
characters.

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
`503`, inspect Vercel logs for the normalized Supabase error details.
