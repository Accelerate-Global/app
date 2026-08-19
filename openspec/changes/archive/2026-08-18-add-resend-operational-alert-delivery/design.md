## Context

The application currently records normalized errors in runtime logs and runs a daily Vercel heartbeat that performs three read-only Supabase queries. Supabase Auth already sends invite and recovery email through Resend SMTP, but the application has no general operational-email path, durable notification state, retry behavior, or provider-independent fallback for a Supabase outage.

The production Supabase database already has `pg_cron`, `pg_net`, and Vault enabled. Supabase Free includes ample Edge Function invocations for the expected alert volume, while the Resend Free plan is shared with Auth email and therefore requires stricter application-owned budgets. GitHub must not participate in operational alert detection or delivery.

## Goals / Non-Goals

**Goals:**

- Persist eligible operational email notifications durably and privately.
- Deliver primary notifications from a Supabase Edge Function through the Resend API.
- Retry transient delivery failures without duplicate emails.
- Send a direct Resend fallback from the existing Vercel heartbeat when Supabase is unavailable.
- Keep operational alerts within a maximum of 20 messages per UTC day and 300 per UTC month for one recipient.
- Keep all credentials and recipient addresses server-only and all email content sanitized.
- Make alerting fail-open for application operations.

**Non-Goals:**

- Capturing every application error or implementing all four future capture boundaries.
- Providing SMS, telephone, on-call rotations, or an SLA-backed pager.
- Adding an incident-management page.
- Changing Supabase Auth SMTP, Auth templates, or authentication behavior.
- Using GitHub workflows, issues, or notifications for operational delivery.

## Decisions

### Use Resend API rather than Supabase Auth SMTP

Supabase Auth SMTP remains dedicated to Auth-generated messages. A separate operational API key sends through Resend's HTTP API so alert templates, idempotency, retry handling, and quotas are controlled independently. Reusing Auth endpoints was rejected because they cannot send arbitrary operational mail and would couple alerts to authentication behavior.

### Use a RLS-protected public outbox with service-role-only RPCs

`operational_alert_notifications` lives in the `public` schema so the Edge Function can use PostgREST without a separate database connection secret. RLS is enabled with no user policies. Table privileges are revoked from `anon` and `authenticated`; narrowly scoped RPC functions are executable only by `service_role` and database-owned jobs. Raw customer payloads, recipient addresses, credentials, and provider objects are prohibited.

The outbox records severity, source, fingerprint, title, sanitized summary, an optional safe details URL, idempotency key, occurrence count, delivery state, attempts, retry time, safe provider error code, and Resend message ID.

### Trigger immediately and retry on one bounded Cron job

An insert trigger calls `pg_net` after enqueueing a pending notification. A single 15-minute `pg_cron` job invokes the same Edge Function to recover from transient failures or missed trigger calls. Both paths read the Edge Function URL and dispatch secret from Supabase Vault. Missing or invalid dispatch configuration is caught and does not roll back the outbox insert.

The Edge Function claims a bounded batch atomically, using row locking to avoid concurrent sends. It processes at most ten notifications sequentially per invocation, below Resend's request-rate limit.

### Enforce budgets and deduplication in Postgres

Database RPCs enforce the system boundary rather than trusting callers:

- one recipient, configured only in runtime secrets;
- only `critical` and `high` notifications are email-eligible;
- one notification per idempotency key;
- a one-hour cooldown for the same fingerprint;
- no more than 20 delivered or claimed notifications per UTC day;
- no more than 300 delivered or claimed notifications per UTC month;
- at most five delivery attempts per notification;
- a 3,000-row outbox ceiling that prunes the oldest 300 terminal records before
  accepting additional work;
- old delivered, failed, and suppressed records are pruned after 90 days.

Budget-exhausted or cooldown-duplicate notifications are retained as suppressed audit records without calling Resend.

### Use deterministic Resend idempotency keys

The Edge Function sends the outbox idempotency key in Resend's `Idempotency-Key` header. A successful response stores the Resend message ID. A retry after an uncertain response therefore cannot create duplicate mail during Resend's idempotency window.

### Keep the heartbeat fallback independent of Supabase

When one of the heartbeat's read-only checks fails, the Vercel route calls Resend directly using Vercel-only server environment variables. Its idempotency key is deterministic per UTC day, preventing duplicate daily outage mail. Failure to send is normalized and logged, but the route still returns the existing HTTP 503 heartbeat response.

This path deliberately does not write delivery state to Supabase because its purpose is to work when Supabase is unavailable.

### Keep email content concise and sanitized

The subject contains severity and operational source. The HTML and text bodies contain only the sanitized title, summary, timestamps, occurrence count, and an optional authenticated details link. Neither runtime constructs email from raw errors or arbitrary HTML. Values are HTML-escaped before rendering.

### Do not introduce an SDK dependency

Both runtimes use the Resend HTTPS API through `fetch`. This keeps the Edge Function and Next.js fallback behavior aligned and avoids adding a package solely for one endpoint.

## Risks / Trade-offs

- **[Supabase is fully unavailable]** The primary outbox and Edge Function cannot run. → The Vercel heartbeat calls Resend directly; on Vercel Hobby this detects the outage only at the heartbeat's daily cadence.
- **[Resend is unavailable]** Neither primary nor fallback email can be delivered. → Primary notifications retry up to five times and remain inspectable in the outbox; the fallback logs a normalized failure.
- **[Free quota is shared with Auth mail]** Operational traffic could consume capacity needed for invites or recovery. → Hard-cap operational email at 20/day and 300/month, deduplicate, use one recipient, and suppress lower severity.
- **[Public-schema table exposure]** A misconfigured policy could expose incident metadata. → Enable RLS, revoke user grants, grant only service-role RPC execution, and run database security/advisor checks.
- **[Trigger network call fails]** Immediate delivery may be missed. → The insert remains successful and the 15-minute Cron retry drains pending work.
- **[Dispatch secret appears in SQL]** A literal secret in a migration would be committed. → Store only Vault secret names in SQL and provision values separately.
- **[Alert loop]** A delivery error could itself enqueue another email. → Edge Function and heartbeat email failures only update/log their own delivery status and never call the general enqueue path.

## Migration Plan

1. Apply the database migration with the outbox, RPCs, trigger, and retry job. Missing Vault configuration leaves dispatch dormant and safe.
2. Create the operational Resend API key and configure Edge Function secrets: API key, sender, recipient, dispatch secret, and optional details URL.
3. Deploy the `send-operational-alert` Edge Function with JWT verification disabled only because it performs constant-time bearer-secret verification itself.
4. Store the Edge Function URL and identical dispatch secret in Supabase Vault.
5. Configure the corresponding Vercel server-only Resend key, sender, recipient, and details URL.
6. Deploy the heartbeat update.
7. Enqueue one synthetic high-severity test alert, verify the Resend ID is persisted, and trigger a controlled heartbeat failure in a non-production environment.

Rollback disables the Cron job and insert trigger first, then rolls back the heartbeat email call and Edge Function. The outbox can remain for audit or be removed in a later migration. Auth SMTP is unaffected throughout.

## Open Questions

- The production recipient address and operational sender address must be supplied as secrets before live delivery can be verified.
- The existing Resend team's current monthly usage must be checked before choosing whether the 300-message operational monthly budget should be lower.
