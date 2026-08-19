## Context

The application now has a production operational-alert outbox, Supabase Edge Function, Resend delivery, and an independent Vercel Supabase heartbeat. `src/lib/operational-alerts.ts` is intentionally fail-open, but no application operation calls it. Existing connection runs and pipeline attempts already persist redacted terminal state, while CSV uploads combine server APIs with a direct browser-to-Supabase Storage transfer. Password sign-in currently calls Supabase Auth directly from the browser, so the server cannot count failed attempts.

The capture layer must remain within the existing free-tier budgets, avoid duplicate mail, preserve current user-facing results, and never persist passwords, email addresses, raw IP addresses, uploaded rows, filenames, provider payloads, or raw error objects. Mutating routes remain protected by the centralized same-origin guard in `src/proxy.ts`.

## Goals / Non-Goals

**Goals:**

- Turn the four approved failure domains into explicit, tested operational-alert producers.
- Alert once for persisted connection-run failures and terminal pipeline-run failures.
- Detect repeated password failures without account enumeration or durable raw identity data.
- Capture upload authorization, storage transfer, parsing, creation, replacement, and row-persistence failures.
- Use fixed summaries, stable fingerprints, deterministic idempotency, and the existing database cooldown and delivery budgets.
- Keep alert capture fail-open and preserve all existing cleanup, retry, response, and authorization behavior.

**Non-Goals:**

- Sending email for every exception, cancellation, validation error, or retryable attempt.
- Adding client-side telemetry, session replay, raw browser error reporting, or an incident UI.
- Changing Supabase Auth invitations, recovery, password policy, or workspace authorization.
- Sending user identifiers, source credentials, uploaded content, or provider details by email.
- Adding GitHub, Sentry, a paid log drain, SMS, or on-call paging.

## Decisions

### Use a typed capture policy instead of ad hoc email construction

A server-only capture module will accept a closed union of operational events and construct the severity, source, title, fixed summary, fingerprint, idempotency key, and optional authenticated details link. Call sites provide only bounded identifiers, safe enum-like failure codes, and timestamps. This prevents routes from copying raw exception messages into the outbox and gives tests one policy surface.

Calling `enqueueOperationalAlert` directly from every catch block was rejected because it would create inconsistent severity, unsafe summaries, and noisy fingerprints.

### Alert on durable failure transitions

Connection runs will alert after their failed state and failure log are persisted. Durable paged connection failures and stale-run reconciliation use the same policy. Pipeline execution will alert only when the database failure transition reports the overall run as terminal `failed`; attempts that remain retryable do not alert yet. Cancellations and review rejections are expected administrator outcomes and do not alert.

This ordering ensures an email never claims a run failed unless the application can subsequently inspect that failure. Alert enqueue failure is logged and ignored.

### Count repeated sign-in failures through a same-origin server route

The sign-in form will call `POST /api/auth/sign-in`. The route uses the existing Supabase SSR server client so successful authentication still sets the normal session cookies. It returns a generic invalid-credentials response and never distinguishes an unknown account from a wrong password.

Invalid-credential failures are recorded in a private table through service-role-only RPCs. The key is an HMAC-SHA-256 digest of the normalized email using a new server-only `AUTH_FAILURE_HASH_SECRET`; the raw email and request IP are never persisted. Five invalid attempts within a rolling 15-minute window trigger one high-severity alert. A successful sign-in clears that subject's active counter. Provider, network, or rate-limit errors alert immediately as an authentication-system failure without including provider payloads.

The table prunes records inactive for 24 hours and refuses new subjects above a 10,000-row ceiling. This bounds free-tier storage under random-identifier attacks. Database and alert failures are fail-open relative to the authentication response.

Client-only counting was rejected because it is trivial to bypass and cannot aggregate attempts. Raw email hashing without a keyed secret was rejected because common addresses are dictionary-recoverable.

### Relay only fixed browser-observed upload stages

Most upload failures are visible in existing server routes and will be captured there. The direct signed Storage upload and browser CSV parser are exceptions. The upload client will create a random operation ID and may report one of a small fixed set of stages to an admin-only same-origin endpoint. The endpoint ignores arbitrary error text and constructs a fixed alert. Local file type, size, missing-classification, and header validation failures do not report.

Server routes capture upload authorization and unexpected create, replace, or row-persistence failures. Dataset transition to `failed` also captures the terminal import failure, with cooldown deduplication preventing multiple emails for one cascade.

Moving the entire file through a Vercel function was rejected because it would add bandwidth, body-size, and execution-duration pressure. Accepting arbitrary client summaries was rejected as an injection and data-leak risk.

### Reuse existing delivery budgets and secrets

All four producers use the existing Supabase outbox and Resend path. No new recipient or Resend configuration is introduced. The only new Vercel secret is `AUTH_FAILURE_HASH_SECRET`, used solely for keyed subject identifiers. Existing one-hour fingerprint cooldown, 20/day, and 300/month email caps remain authoritative.

## Risks / Trade-offs

- **[Vercel or the application route is unavailable]** Browser-observed upload and sign-in events cannot be captured. → The independent heartbeat still detects Supabase outages; no free-tier architecture can guarantee alerting when both runtimes are unavailable.
- **[An attacker submits many random email addresses]** The private counter could grow. → Prune after 24 hours, cap at 10,000 active rows, store only keyed digests, and rely on existing Supabase Auth rate limits.
- **[One underlying upload failure reaches more than one capture point]** Multiple outbox records could be created. → Use category-level fingerprints and the existing one-hour cooldown; deterministic operation/stage idempotency prevents exact duplicates.
- **[Alert persistence fails]** The originating operation could be delayed or altered. → Every call is awaited only for deterministic ordering but uses the fail-open helper; tests assert original responses and state are preserved.
- **[Server-routed sign-in changes cookie behavior]** Successful users could fail to establish sessions. → Use the existing SSR client, add route and form tests, and run authenticated browser smoke before production deployment.
- **[Fixed alert summaries provide less detail]** Diagnosis may require logs or run pages. → Include safe authenticated details links for durable runs and keep normalized protected logging at the failure site.

## Migration Plan

1. Add the private authentication-failure table and service-role-only RPCs in a Supabase migration, with RLS, pruning, and capacity tests.
2. Add the typed capture policy and focused unit tests.
3. Add connection and terminal pipeline producers, then upload producers and the fixed admin relay.
4. Add the server sign-in route, update the existing form, and configure `AUTH_FAILURE_HASH_SECRET` in Vercel Production.
5. Apply the migration, run all repository verification gates, deploy Vercel, and verify one synthetic alert for each server-side producer using test-only injected failures rather than damaging production providers.
6. Rollback by reverting producer call sites and the sign-in route first. The private counter table can remain inert or be removed in a follow-up migration; the existing delivery system continues independently.

## Open Questions

None. The initial repeated-failure threshold is five invalid attempts within 15 minutes, and the existing one-hour alert cooldown remains the anti-noise authority.
