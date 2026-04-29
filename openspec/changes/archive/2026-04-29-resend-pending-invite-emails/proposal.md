## Why

Admins can see pending invited users in User Management, but the current detail
actions only offer password reset, disable, and role controls. A pending invite
recipient who missed or lost the original email needs an admin-safe resend path
before the account is accepted.

## What Changes

- Add an admin-only action to resend a fresh Supabase invite email for users
  whose invite is still pending.
- Hide password reset for pending invites and keep it available for active or
  pending-confirmation non-disabled accounts.
- Tighten pending-invite status so accepted or confirmed invited accounts are
  active even if they have not signed in after accepting.
- Non-goals: no custom email provider, no copyable raw invite link, no changes
  to role assignment, allowlist provisioning, session revocation, or first-admin
  bootstrap.

## Capabilities

### New Capabilities
- `admin-pending-invite-resend`: Admin-only resend behavior for still-pending
  Supabase invite emails.

### Modified Capabilities
- `workspace-role-permissions`: User Management status/action behavior changes
  for pending invited accounts.

## Impact

- Affects auth, admin permissions, Supabase Auth calls, API contracts, and the
  existing User Management UI smoke surface.
- Expected code areas: `src/lib/user-management.ts`,
  `src/app/api/admin/users/**`, and
  `src/components/dashboard/user-management-client.tsx`.
- Verification follows current repo policy from `pnpm run verify:change`,
  including OpenSpec validation, TypeScript/app verification, DB security due to
  the existing dirty tree, migration drift, and the targeted User Management/auth
  smoke subset.
