# Operational Alert Email

Operational incident email uses Resend without relying on GitHub:

```text
Primary: Supabase outbox -> Supabase Edge Function -> Resend -> developer
Fallback: Vercel Supabase heartbeat -> Resend -> developer
```

Supabase Auth continues to use its existing Resend SMTP configuration for
invites and password recovery. Operational email uses a separate Resend API key
so it can be rotated without interrupting Auth.

## Delivery and Free-Tier Contract

- Only `critical` and `high` notifications are immediately email eligible.
- One recipient is configured per runtime; recipient addresses are not stored
  in the outbox.
- The database permits at most 20 operational messages per UTC day and 300 per
  UTC month.
- One fingerprint is email eligible per hour. Duplicate idempotency keys reuse
  the original outbox row.
- Resend receives a deterministic `Idempotency-Key` header for every message.
- Transient primary-delivery failures retry with increasing delay and stop
  after five attempts.
- A 15-minute Supabase Cron job recovers missed immediate dispatch and prunes
  terminal records after 90 days.
- The outbox has a 3,000-row hard ceiling and prunes the oldest 300 terminal
  records before accepting more work; callers must treat a capacity rejection
  as fail-open telemetry failure.
- Alerting is fail-open for application behavior: failure to persist or send an
  alert must not fail the customer operation that produced it.

These limits reserve most of Resend's Free-plan allowance for existing Auth
email. Multiple recipients would each count against Resend quota, so adding
recipients requires revisiting the budget.

## Safe Content

Operational email may contain only severity, source, sanitized title and
summary, occurrence count, timestamp, and an optional authenticated HTTPS
details link. It must never contain passwords, tokens, API keys, recipient
addresses in database rows, raw IP addresses, uploaded rows, connection
credentials, raw provider objects, or arbitrary HTML.

## Resend Setup

In the existing Resend team:

1. Keep `accelerateglobal.org` verified.
2. Create a restricted API key dedicated to operational transactional email.
3. Use a sender such as
   `Accelerate Global Alerts <alerts@accelerateglobal.org>`.
4. Keep Auth SMTP on its existing credential and sender.
5. Check the Resend Usage page before increasing the operational budgets.

## Supabase Edge Function Secrets

Configure these with `supabase secrets set` or the Supabase Dashboard. Do not
commit their values:

```text
RESEND_OPERATIONAL_API_KEY
OPERATIONAL_ALERT_FROM
OPERATIONAL_ALERT_RECIPIENT
OPERATIONAL_ALERT_DETAILS_URL
OPERATIONAL_ALERT_DISPATCH_SECRET
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to hosted Edge
Functions by Supabase. `OPERATIONAL_ALERT_DISPATCH_SECRET` must be a random
value and must match the value stored in Vault below.

Discover the current CLI syntax before changing a hosted project:

```bash
supabase secrets set --help
supabase functions deploy --help
```

Deploy the function after its secrets are configured:

```bash
supabase functions deploy send-operational-alert \
  --project-ref <project-ref> \
  --no-verify-jwt
```

JWT verification is disabled only because the function performs its own
constant-time bearer-secret verification before claiming any work.

## Supabase Vault Setup

Create these two named Vault secrets through the Dashboard or SQL editor:

```text
operational_alert_edge_function_url
  https://<project-ref>.supabase.co/functions/v1/send-operational-alert

operational_alert_dispatch_secret
  <same random value as OPERATIONAL_ALERT_DISPATCH_SECRET>
```

The migration stores only these names. It never commits or copies the secret
values. Missing Vault configuration makes immediate and retry dispatch no-op
without rolling back an outbox insert.

## Vercel Fallback Variables

Configure these as server-only Vercel environment variables for Production:

```text
RESEND_OPERATIONAL_API_KEY
OPERATIONAL_ALERT_FROM
OPERATIONAL_ALERT_RECIPIENT
OPERATIONAL_ALERT_DETAILS_URL
```

The Vercel value can use the same dedicated operational Resend API key, though
a separate fallback key provides more granular revocation. None may use a
`NEXT_PUBLIC_` prefix. Keep `CRON_SECRET` configured as described in the
heartbeat runbook.

## Verification

After applying the migration, deploying the Edge Function, and provisioning
secrets, enqueue one fixed non-sensitive test notification in the Supabase SQL
editor:

```sql
select public.enqueue_operational_alert(
  'operational-alert-setup-test-v1',
  'operational-alert-setup-test',
  'high',
  'operations.setup',
  'Operational alert delivery test',
  'This is a fixed non-sensitive setup verification message.',
  'https://data.accelerateglobal.org',
  1
);
```

Verify the outbox without displaying credentials or recipient values:

```sql
select
  idempotency_key,
  status,
  attempt_count,
  resend_message_id is not null as has_resend_message_id,
  last_error_code,
  created_at,
  sent_at
from private.operational_alert_notifications
where idempotency_key = 'operational-alert-setup-test-v1';
```

Verify the Vercel fallback in a non-production environment by mocking or
temporarily pointing the heartbeat Supabase client at an unavailable test
project. Do not intentionally disable or corrupt production Supabase.

## Rotation and Recovery

1. Create a replacement Resend key.
2. Update Supabase Edge Function secrets and Vercel environment variables.
3. Verify one non-sensitive test delivery.
4. Revoke the former key in Resend.

If primary delivery stops, inspect the outbox's `status`, `attempt_count`, and
sanitized `last_error_code`, then inspect Edge Function logs. If Resend is
unavailable, pending work retries up to five times. If Supabase is unavailable,
the daily Vercel heartbeat sends the independent fallback directly through
Resend.

## Rollback

Disable the `retry-operational-alert-delivery` Cron job and the
`operational_alert_notifications_dispatch` trigger before removing or rolling
back the Edge Function. The heartbeat fallback can be reverted independently.
Existing Supabase Auth SMTP remains unchanged.

GitHub workflows, issues, checks, and notification settings are explicitly not
part of this delivery system.
