## Why

User Management needs a protected top-level role so trusted operators can manage
all workspace roles while standard admins keep existing operational permissions
without being able to remove the highest-privilege account.

## What Changes

- Add `super_admin` as a canonical workspace role stored in trusted Supabase
  Auth app metadata.
- Treat `super_admin` as admin-capable anywhere `admin` can access datasets,
  admin pages, and admin APIs.
- Allow only super admins to assign `super_admin` or mutate existing super
  admin accounts from User Management.
- Promote an existing `admin@example.com` Auth user to `super_admin` by
  migration when that user exists.
- Preserve current `basic`, `pro`, and `admin` permissions outside the new
  super-admin protection boundary.
- Non-goals: no hard-delete user feature, no user-metadata authorization, no
  Vercel deployment behavior changes, and no browser smoke role expansion.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `workspace-role-permissions`: Adds the `super_admin` role, admin-capable role
  behavior, super-admin-only role management protections, and first super-admin
  migration behavior.

## Impact

- Affects auth, admin permissions, Supabase Auth metadata, API contracts,
  database RLS helpers, User Management UI behavior, analytics role validation,
  OpenSpec validation, and database security tests.
- Expected areas include `src/lib/workspace-role.ts`,
  `src/lib/user-management.ts`, `src/app/api/admin/users/**`,
  `src/components/dashboard/user-management-client.tsx`,
  `supabase/migrations`, `supabase/tests/database`, and
  `docs/architecture/current-state.md`.
