## Context

The app already owns the browser-side invite and recovery flows through
`/auth/confirm` and `/reset-password`. Supabase owns email rendering, with the
repo storing the canonical local HTML in `supabase/templates/invite.html` and
`supabase/templates/recovery.html`. Hosted SMTP has been switched to Resend, so
this change only updates content and hosted templates.

## Goals / Non-Goals

**Goals:**

- Make invite and recovery email visuals feel consistent with the application:
  AG logo at top-left, wide dashboard-style page shell, warm app background,
  primary CTA, and restrained app-like typography.
- Keep HTML email compatibility by using inline CSS and no external font or
  image dependencies.
- Preserve the token-hash confirmation URLs required by the SSR password setup
  flow.
- Remove the extra recovery site URL line so the CTA remains the only primary
  link.

**Non-Goals:**

- Do not change Resend SMTP settings or API keys.
- Do not introduce a shared email rendering framework.
- Do not add templates that are not currently configured in `supabase/config.toml`.
- Do not alter admin user-management application code for the one-time hosted
  user deletion.

## Decisions

- Use static inline HTML templates rather than a component renderer because
  Supabase hosted Auth accepts pasted HTML and the current repo already stores
  canonical templates this way. Alternative considered: React Email, but that
  would add build/publish complexity for two simple Auth templates.
- Keep all styling email-safe with inline fallbacks and a small head style block
  for dark mode. The logo uses the deployed app asset so the email inherits the
  same first-viewport brand signal as the dashboard.
- Test the templates as contract files by reading the HTML from disk and
  asserting required tokens, branding values, and absence of the removed footer.
  This catches accidental regression without requiring browser smoke coverage.

## Risks / Trade-offs

- Hosted Supabase templates can drift from repo templates if updated manually.
  Mitigation: update the runbook and publish both templates after verification.
- Some email clients may ignore dark-mode media queries. Mitigation: keep the
  core hierarchy, colors, logo, and CTA styling inline and readable without
  those enhancements.
- Deleting a Supabase Auth user cascades Auth identities/sessions/tokens but
  does not revoke already-issued JWTs immediately. Mitigation: the account is
  removed from Auth and the allowlist, and verification confirms no remaining
  hosted records for that email.

## Migration Plan

1. Update and verify repo templates and docs.
2. Delete `removed-user@example.com` from hosted Auth and `signup_email_allowlist`.
3. Publish the verified invite and recovery HTML into hosted Supabase Auth.
4. Send a recovery email to confirm the hosted template and sender behavior.
