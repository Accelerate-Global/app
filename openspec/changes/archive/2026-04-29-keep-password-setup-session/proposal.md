## Why

Invited and recovered users already have a Supabase callback session when they
set a password on `/reset-password`. Signing them out immediately after the
password update forces a second sign-in and has produced invalid-credentials
reports even though Auth accepted the password update.

## What Changes

- Keep the successful password setup session active after
  `supabase.auth.updateUser({ password })`.
- Redirect successful password setup directly to `/dashboard`.
- Send recovery and invite email callbacks through `/auth/confirm` with
  Supabase token hashes so the server can verify the callback and set session
  cookies before `/reset-password` renders.
- Keep `/reset-password` able to recover from direct token-hash callback params
  as a compatibility fallback.
- Update unit and UI smoke coverage so the regression is caught if the flow
  signs users out again.
- Preserve existing invalid-link handling and callback restoration behavior.

## Capabilities

### New Capabilities
- `auth-password-setup-session`: Password setup from Supabase invite or recovery
  callbacks keeps the verified session and lands on the authenticated app.

### Modified Capabilities
- None.

## Impact

- Affects Supabase Auth session handling in
  `src/components/auth/reset-password-form.tsx`.
- Affects recovery/invite redirect targets in auth forms, admin user routes, and
  Supabase local auth email templates.
- Affects auth regression tests and the existing password reset UI smoke
  journey.
- No public API, database, route, role, or Vercel deployment contract changes.
