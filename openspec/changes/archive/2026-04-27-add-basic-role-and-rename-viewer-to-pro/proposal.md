## Why

The workspace needs a clearer role ladder: the current standard `viewer` role is becoming `pro`, and a lower `basic` role is needed for read-oriented users who can explore and download datasets without changing account/profile data or creating new saved dataset tables.

## What Changes

- Rename the canonical standard workspace role from `viewer` to `pro`; existing stored `viewer` metadata is migrated to `pro`, while `viewer` remains a legacy parse alias.
- Add a `basic` workspace role below `pro`.
- Preserve current standard-user capabilities for `pro`.
- Allow `basic` users to sign in, browse public datasets, filter/sort dataset criteria, open accessible existing saved tables, and download datasets or saved tables.
- Deny `basic` users profile name/email changes, self-disable, and new saved-table creation.
- Update Admin User Management so admins can invite, filter, promote, and demote users across `admin`, `pro`, and `basic`.
- Update Supabase migration/security coverage for role metadata migration, basic saved-table insert denial, and basic profile metadata/email update denial.
- Update analytics role reporting and UI smoke coverage to use `pro` and include `basic`.
- Non-goals: do not rewrite historical analytics rows, do not auto-assign any user to `basic`, and do not change private dataset access, admin dataset management, or existing saved-table ownership semantics beyond basic create denial.

## Capabilities

### New Capabilities
- `workspace-role-permissions`: Workspace role names, role hierarchy, admin role management, and profile/account restrictions.

### Modified Capabilities
- `authenticated-dataset-access`: Rename non-admin standard viewers to `pro`, add `basic` dataset/saved-table access rules, and deny `basic` saved-table creation.

## Impact

- Affects auth and admin permissions through `src/lib/workspace-role.ts`, `src/lib/auth.ts`, `src/lib/user-management.ts`, `src/lib/validation.ts`, and Admin User Management UI/API.
- Affects profile/account APIs and UI through `src/components/auth/account-profile-form.tsx` and `src/app/api/account/disable/route.ts`.
- Affects saved-table API/UI contracts through `/api/saved-tables`, dataset detail actions, and dashboard saved-table surfaces.
- Affects Supabase through a tracked migration and `supabase/tests/database/001_public_security.test.sql`.
- Affects UI smoke harness, route registry, smoke users/projects, and route/journey coverage.
- Affects analytics role values emitted by new events; historical stored analytics rows remain unchanged.
