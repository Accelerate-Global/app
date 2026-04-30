## 1. Planning

- [x] 1.1 Run `pnpm run verify:change` before implementation.
- [x] 1.2 Run `pnpm run task:kickoff` for the reset-password, smoke, and
  OpenSpec paths.

## 2. Auth Flow

- [x] 2.1 Update reset-password success behavior to keep the Supabase session
  active and redirect to `/dashboard`.
- [x] 2.2 Update reset-password unit coverage to assert no sign-out, dashboard
  redirect, password update, and success analytics.
- [x] 2.3 Update the password reset UI smoke journey to expect the dashboard
  immediately after saving the new password.
- [x] 2.4 Preserve the incoming callback host when `/auth/confirm` redirects to
  `/reset-password` after token verification.
- [x] 2.4 Route recovery and invite email redirect targets through
  `/auth/confirm?next=/reset-password`.
- [x] 2.5 Update Supabase recovery and invite email templates to append
  `token_hash` and callback `type` to `{{ .RedirectTo }}`.
- [x] 2.6 Add reset-password token-hash fallback handling and route/test
  coverage for invite and recovery callback verification.
- [x] 2.7 Harden local Supabase verification startup waits for password setup
  smoke and database security gates.

## 3. Verification

- [x] 3.1 Run focused auth and reset-password unit/API tests.
- [x] 3.2 Run `pnpm run smoke:check`.
- [x] 3.3 Rerun `pnpm run verify:change` and complete required commands.
- [x] 3.4 Run `pnpm run verify:change:run` before finalizing.
