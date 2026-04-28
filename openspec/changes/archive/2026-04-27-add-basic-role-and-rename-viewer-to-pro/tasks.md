## 1. Planning And Role Model

- [x] 1.1 Run `pnpm run verify:change` and `pnpm run task:kickoff` for the owned auth, admin, dataset, smoke, Supabase, and OpenSpec paths.
- [x] 1.2 Update role parsing, role labels, validation, analytics typing, and identity resolution for canonical `admin`, `pro`, and `basic`, with legacy `viewer` parsed as `pro`.
- [x] 1.3 Update user management helpers and UI so admins can invite, filter, promote, and demote `pro` and `basic` users without allowing last-admin demotion.

## 2. Basic Permission Enforcement

- [x] 2.1 Block `basic` profile name/email edits and self-disable in the profile UI and `/api/account/disable`.
- [x] 2.2 Block `basic` saved-table creation in `/api/saved-tables` and hide the dataset detail save action while keeping downloads available.
- [x] 2.3 Preserve existing saved-table read, update, delete, open, and download behavior for `basic` owners with accessible datasets.

## 3. Supabase And Security

- [x] 3.1 Create a Supabase migration with `supabase migration new` that migrates `viewer` app metadata to `pro`, updates saved-table insert RLS to deny `basic`, and adds the `basic` auth profile update guard trigger.
- [x] 3.2 Update database security tests for role migration, basic public dataset reads, basic private dataset denial, basic saved-table insert denial, and basic auth profile update denial.

## 4. UI Smoke And Direct Tests

- [x] 4.1 Update UI smoke users, storage states, projects, project context, route registry ids, and journey selection for `pro` plus targeted `basic` coverage.
- [x] 4.2 Add/update Vitest coverage for role parsing, identity role reporting, user management roles, profile restrictions, account disable restrictions, saved-table create denial, and dataset action-bar behavior.

## 5. Verification

- [x] 5.1 Run focused direct tests for touched units/components/routes.
- [x] 5.2 Run `pnpm run smoke:check`.
- [x] 5.3 Rerun `pnpm run verify:change` and complete all required commands through `pnpm run verify:change:run`.
- [x] 5.4 Archive the OpenSpec change only after implementation and required verification pass.
