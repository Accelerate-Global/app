## Why

Invited `basic` users can hit a Supabase Auth update failure while trying to finish
account setup because the Basic profile-update guard blocks Auth metadata updates
too early. The invite flow also lands users on the generic sign-in surface, which
makes password setup unclear and encourages fallback sign-up attempts.

## What Changes

- Allow the initial invited-user account setup transition for `basic` users while
  preserving the existing restriction on later Basic profile name, email, and
  self-disable changes.
- Send workspace invites to the password setup surface so invite links establish a
  session and present the new-password form.
- Generalize reset-password session restoration so invite callback sessions can
  use the same password setup UI as recovery links.
- Keep admin role management, allowlist enforcement, and post-activation Basic
  restrictions unchanged.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `workspace-role-permissions`: Basic users may complete initial invite/password
  setup before the profile-update restriction applies.

## Impact

- Affects auth and admin invite behavior in `src/app/api/admin/users/route.ts`,
  `src/components/auth/reset-password-form.tsx`, and related tests.
- Affects Supabase Auth trigger behavior via a new migration under
  `supabase/migrations` and database security coverage in
  `supabase/tests/database/001_public_security.test.sql`.
- Affects OpenSpec behavior only for the existing `workspace-role-permissions`
  capability.
- Does not change Vercel deployment behavior, public API shapes, UI smoke route
  coverage, or existing role labels.
