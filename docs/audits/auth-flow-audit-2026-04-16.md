# Auth Flow Audit

Date: 2026-04-16

## Findings

| Priority | Status | Surface | Evidence | Remediation |
| --- | --- | --- | --- | --- |
| P1 | Fixed in repo | `/auth/confirm` redirect handling | The route previously built `new URL(next, origin)` directly from the untrusted `next` query param, which allowed external and protocol-relative redirect targets. | Added [`src/lib/auth-redirect.ts`](/Users/blake/Documents/accelerate-global/online/src/lib/auth-redirect.ts) and routed all auth callback URLs through it. Added regression coverage in [`src/lib/auth-redirect.test.ts`](/Users/blake/Documents/accelerate-global/online/src/lib/auth-redirect.test.ts) and [`src/app/auth/confirm/route.test.ts`](/Users/blake/Documents/accelerate-global/online/src/app/auth/confirm/route.test.ts). |
| P2 | Fixed in repo | Auth lifecycle smoke coverage | The browser suite previously validated auth entry pages plus bootstrap sign-in, but not sign-up allowlist behavior, recovery-link handling, password reset completion, sign-out, or disable-account re-entry. | Extended bootstrap data and added end-to-end auth journeys in [`tests/ui/10-journeys.spec.ts`](/Users/blake/Documents/accelerate-global/online/tests/ui/10-journeys.spec.ts), [`tests/ui/route-registry.ts`](/Users/blake/Documents/accelerate-global/online/tests/ui/route-registry.ts), and [`scripts/smoke-bootstrap.ts`](/Users/blake/Documents/accelerate-global/online/scripts/smoke-bootstrap.ts). |
| P2 | Fixed in repo | Auth helper and form regression coverage | `AuthForm`, `ResetPasswordForm`, and the Supabase proxy refresh path did not have dedicated tests, leaving the most security-sensitive client and cookie-refresh paths under-covered. | Added targeted coverage in [`src/components/auth/auth-form.test.tsx`](/Users/blake/Documents/accelerate-global/online/src/components/auth/auth-form.test.tsx), [`src/components/auth/reset-password-form.test.tsx`](/Users/blake/Documents/accelerate-global/online/src/components/auth/reset-password-form.test.tsx), and [`src/lib/supabase/proxy.test.ts`](/Users/blake/Documents/accelerate-global/online/src/lib/supabase/proxy.test.ts). |
| P2 | Fixed in repo | Allowlist and metadata trust boundary | The repo already used `app_metadata` for authorization, but the DB suite did not explicitly lock in the difference between trusted `raw_app_meta_data` and user-editable `raw_user_meta_data`, and did not prove the signup trigger rejects direct `auth.users` insertion for blocked emails. | Extended [`supabase/tests/database/001_public_security.test.sql`](/Users/blake/Documents/accelerate-global/online/supabase/tests/database/001_public_security.test.sql) to assert both behaviors. |
| P2 | Manual hosted follow-up | Hosted auth domain and policy posture | Public checks on 2026-04-16 showed `https://data.accelerateglobal.org/` and `https://data.accelerateglobal.org/forgot-password` returning `200`, while `auth.data.accelerateglobal.org` did not resolve. Local Supabase defaults also remain permissive: `enable_confirmations=false`, `secure_password_change=false`, and `minimum_password_length=6`. | Review hosted Supabase Auth settings explicitly before changing production behavior. Confirm `SITE_URL`, redirect allow-list, password-change reauthentication, email confirmation policy, password minimums, rate limits, CAPTCHA, SMTP sender branding, and custom auth-domain setup in the hosted dashboard. |

## Verified Non-Findings

- Server-side identity resolution continues to use `supabase.auth.getUser()` instead of trusting `getSession()` payloads.
- Authorization checks in app code and DB policy helpers continue to derive admin capability from `app_metadata.workspace_role`, not `user_metadata`.
- Account disable continues to combine user banning with session revocation and local cookie sign-out; the smoke suite now exercises the user-visible re-entry failure path.

## Hosted Follow-Up Checklist

- Verify the hosted Supabase `SITE_URL` and every exact redirect URL used by production and preview auth callbacks.
- Confirm whether production should require email confirmations and secure password change reauthentication before flipping those switches.
- Raise the effective minimum password requirement if product policy wants stronger-than-default local behavior.
- Decide whether CAPTCHA is required on sign-in/sign-up/reset endpoints in hosted Auth.
- Complete branded auth-link hosting if `auth.data.accelerateglobal.org` is intended to be the email-link host.
