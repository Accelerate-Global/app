## Why

The production Resend delivery paths are live, but application failures do not call them, so connection, pipeline, authentication, and upload incidents still remain only in transient logs or user-visible errors. The four trusted server boundaries need explicit, privacy-safe producers so the developer is notified about actionable failures without turning ordinary validation mistakes into alert noise.

## What Changes

- Add one shared server-only capture policy that converts approved failure categories into sanitized, stable operational-alert inputs and calls the existing fail-open delivery helper.
- Emit alerts when API connection tests, access checks, source pulls, and persisted connection runs reach actionable failed states.
- Emit alerts when dataset refresh or scheduled pipeline work fails after execution has begun, while preserving existing retry, cleanup, and publication guarantees.
- Route password sign-in through a same-origin server endpoint so repeated invalid attempts can be counted in a private bounded window and provider/system authentication failures can be alerted without storing email addresses, passwords, raw IP addresses, or provider payloads.
- Emit alerts for server-observed dataset upload authorization, import parsing, dataset creation, replacement, and row-persistence failures; browser-only validation errors remain non-alerting.
- Add stable fingerprints, deterministic per-occurrence idempotency keys, severity rules, and tests that prove notification failure never changes the originating operation's result.
- Preserve the existing Supabase Edge Function to Resend primary path, Vercel heartbeat fallback, and explicit absence of GitHub operational delivery.

## Capabilities

### New Capabilities

- `operational-alert-capture-boundaries`: Defines the four trusted server-side failure capture boundaries, their actionable thresholds, sanitized content, deduplication identity, and fail-open behavior.

### Modified Capabilities

- `api-connection-runs`: Failed connection tests, imports, and source access checks become operational-alert producers after their existing redacted failure state is persisted.
- `dataset-onboarding`: Server-observed CSV upload and import failures become operational-alert producers without alerting on local validation errors.
- `pipeline-operations`: Failed scheduled or administrator-started dataset pipeline attempts become operational-alert producers without changing retry or publication behavior.
- `operational-alert-email-delivery`: Trusted application producers use the existing bounded outbox and Resend delivery path while preserving its current quotas and safety rules.

## Impact

- Application code: API connection run finalization, pipeline execution, dataset upload/import routes, the sign-in form, and a new same-origin sign-in route.
- Supabase: a private, RLS-protected authentication-failure window and service-role-only RPCs added by migration; the existing operational outbox and Edge Function remain the delivery mechanism.
- Auth: sign-in moves from a direct browser SDK call to a same-origin server route that preserves Supabase SSR cookies and existing success/error UX. Repeated invalid attempts are counted using keyed one-way identifiers; passwords and raw identifiers are never persisted.
- Data integrity: alert capture remains fail-open and cannot change run status, cleanup, import, retry, or publication outcomes.
- Admin permissions: unchanged; existing route authorization remains authoritative.
- Vercel deployment: the Next.js application gains capture call sites and the sign-in route; existing production secrets are reused.
- API contracts: one new internal same-origin sign-in endpoint; existing connection, dataset, pipeline, and heartbeat responses remain compatible.
- UI smoke: no new page or shared UI primitive is planned; the existing sign-in form behavior changes behind its current UI.

Non-goals include alerting on every thrown exception, alerting on ordinary client-side validation, storing raw customer data in alerts, adding an incident UI, using a paid observability product, changing Auth invitation/recovery email, or using GitHub for operational delivery.
