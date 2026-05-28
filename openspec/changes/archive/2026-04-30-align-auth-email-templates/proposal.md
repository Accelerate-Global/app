## Why

Supabase Auth emails are now sent from the production Resend SMTP sender, but
the invite and password recovery HTML still reads like an older standalone
template and the recovery email exposes an extra site URL line. The auth emails
should match the application style and keep the single action link clear.

## What Changes

- Restyle the local Supabase Auth invite and recovery templates to use the
  dashboard page shell, real AG logo treatment, application light/dark palettes,
  type scale, and compact button shape.
- Remove the recovery footer sentence that renders the app site URL outside the
  reset CTA.
- Keep invite and recovery CTA URLs on the existing token-hash confirmation
  flow.
- Update the auth email runbook to reflect the current Resend SMTP setup and
  hosted-template publication steps.
- Track the one-time hosted deletion of `removed-user@example.com` from Auth and the
  signup allowlist as operational work.
- Non-goals: no SMTP reconfiguration, no new transactional email provider, no
  changes to confirmation, magic-link, email-change, or app-level email code.

## Capabilities

### New Capabilities

- `auth-email-branding`: Supabase Auth invite and recovery emails use the
  dashboard-aligned branded template contract.

### Modified Capabilities

- `auth-password-setup-session`: Recovery and invite email links keep using the
  existing token-hash callback contract while the surrounding email content is
  restyled.

## Impact

- Affects Supabase hosted Auth email rendering and the local source templates in
  `supabase/templates`.
- Affects documentation in `docs/auth-email-branding.md`.
- Adds a focused template contract test under `src/lib`.
- Does not change app routes, public APIs, database schema, RLS, Vercel
  deployment behavior, or UI smoke route coverage.
