## Why

Operational failures currently reach only short-lived runtime logs, so a developer can miss errors that require remediation. The application already uses Resend for Supabase Auth delivery; operational alerts should use a separate, bounded Resend path without relying on GitHub for detection or notification.

## What Changes

- Add a durable, private operational-notification outbox with deduplication, retry state, delivery budgets, and sanitized alert payloads.
- Add a Supabase Edge Function that claims eligible outbox records and sends developer alerts through the Resend API.
- Add a Supabase database trigger and Cron retry path that invoke the Edge Function without depending on Vercel or GitHub.
- Extend the existing Vercel Supabase heartbeat so a failed database check sends an independent alert directly through Resend.
- Keep Supabase Auth SMTP dedicated to invite and recovery messages; operational delivery uses separate credentials and sender configuration.
- Remove GitHub from the operational alert delivery architecture and documentation.
- Add free-tier protections: one recipient by default, severity filtering, per-incident cooldowns, idempotency keys, and daily/monthly operational-email caps.
- Add tests and runbooks for delivery, retries, quota suppression, secret handling, and failure behavior.

## Capabilities

### New Capabilities

- `operational-alert-email-delivery`: Durable, deduplicated operational incident email delivery through a Supabase Edge Function and Resend, including retry and free-tier budget behavior.

### Modified Capabilities

- `supabase-heartbeat`: The protected Vercel heartbeat sends a direct Resend alert when its Supabase checks fail, without changing its read-only database behavior.
- `deployment-secret-security`: Operational Resend credentials and recipients remain server-only in the owning Supabase or Vercel runtime and are never exposed to browsers or stored as incident data.

## Impact

- Supabase: new private operational-alert tables/functions, a migration, one Edge Function, Edge Function secrets, `pg_net`, and `pg_cron` integration.
- Vercel: the existing `/api/ops/supabase-heartbeat` route gains a direct Resend fallback and requires server-only operational-email environment variables.
- Application code: shared Resend request construction, redaction, idempotency, quota, and heartbeat tests.
- External systems: Resend becomes the sole operational email provider; GitHub is not used for alert delivery.
- Auth: no sign-in, invite, recovery, session, or permission behavior changes. Existing Supabase Auth SMTP remains unchanged.
- Data integrity: alert persistence is fail-open for product operations and stores no raw provider payloads, credentials, uploaded data, or email bodies containing user data.
- API contracts: the existing heartbeat preserves its authorization and success/error responses.
- UI smoke coverage: no page, dialog, menu, tooltip, popover, or shared UI primitive changes are planned.

Non-goals include implementing the four application-wide capture boundaries, adding an incident-management UI, adding SMS/on-call paging, changing Supabase Auth templates, or deploying a paid observability provider.
