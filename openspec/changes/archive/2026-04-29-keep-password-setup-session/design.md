## Context

`/reset-password` restores Supabase invite and recovery callback sessions before
allowing `auth.updateUser({ password })`. The current success path signs that
session out and redirects to the anonymous sign-in page, which adds an
unnecessary second credential entry after Supabase has already verified the
callback and accepted the password change.

Supabase SSR guidance recommends email templates use `{{ .TokenHash }}` for
server-side confirmation routes. The default `{{ .ConfirmationURL }}` flow can
return session details in URL fragments that a server route cannot read, and
PKCE code exchange can also depend on browser-local verifier state. The app
already has `/auth/confirm`, so recovery and invite emails should target that
route with token hashes before landing on `/reset-password`.

## Goals / Non-Goals

**Goals:**
- Keep the verified Supabase session active after successful password setup.
- Send successful invite and recovery password setup flows to `/dashboard`.
- Route recovery and invite email callbacks through `/auth/confirm` token-hash
  verification.
- Keep direct token-hash handling on `/reset-password` as a compatibility
  fallback.
- Lock the behavior with focused component coverage and the existing UI smoke
  password reset journey.

**Non-Goals:**
- Do not change invalid-link messaging, Auth metadata, RLS, or database schema.
- Do not add a new invite acceptance route.

## Decisions

- Redirect to `/dashboard` immediately after `updateUser` succeeds.
  - Rationale: Supabase documents the change-password step as updating the
    password from the authenticated callback session, so the app should preserve
    that session for the authenticated destination.
  - Alternative considered: keep sign-out plus a second sign-in. Rejected
    because it is the reported failure path and duplicates credential entry.
- Use `buildAuthConfirmUrl(origin, "/reset-password")` as the redirect target
  for recovery and invite emails, and have local Supabase templates append
  `token_hash` plus `type`.
  - Rationale: the server `/auth/confirm` route can verify token hashes and set
    cookies before rendering the reset page, while `{{ .RedirectTo }}` preserves
    the app origin that initiated the email.
  - Alternative considered: keep direct `/reset-password` links only. Rejected
    because the reset page can render without a server-readable session and show
    the invalid-link state even when the email callback is valid.
- Assert the session-retention contract in `ResetPasswordForm` unit tests and
  the existing UI smoke journey.
  - Rationale: the unit test catches accidental `signOut` reintroduction
    quickly, while smoke proves the browser flow reaches the dashboard.
- Preserve the incoming callback host when `/auth/confirm` redirects after
  server-side token verification.
  - Rationale: Supabase session cookies are host-scoped; redirecting from
    `127.0.0.1` to `localhost` loses the freshly set cookies before
    `/reset-password` renders.

## Risks / Trade-offs

- Users who expected to land on sign-in after password reset now enter the app
  directly -> Mitigation: this matches the verified callback session and normal
  authenticated redirect behavior.
- A stale or missing callback session could still fail before password update ->
  Mitigation: preserve the existing invalid-link and update failure branches.
- Hosted Supabase templates must be updated to match repo templates -> Mitigation:
  document the hosted-template copy step in the auth email branding runbook and
  keep direct token-hash reset-page handling as a fallback.
