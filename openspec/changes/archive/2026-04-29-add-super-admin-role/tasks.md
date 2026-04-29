## 1. Planning

- [x] 1.1 Run `pnpm run verify:change` before implementation and record required commands.
- [x] 1.2 Run `pnpm run task:kickoff` for auth, admin, DB, UI, docs, and OpenSpec paths.

## 2. Role Model And Server Permissions

- [x] 2.1 Add `super_admin` to workspace role parsing, analytics validation, and admin-capable helpers.
- [x] 2.2 Enforce actor-role-aware invite and update permissions for super-admin assignment and mutation.
- [x] 2.3 Preserve self-change, last active admin-capable, and last active super-admin protections.

## 3. User Management UI

- [x] 3.1 Show `Super Admin` in user rows, filters, badges, and detail sheets.
- [x] 3.2 Let only super admins select or invite the `Super Admin` role.
- [x] 3.3 Disable standard-admin mutation controls for super-admin accounts with explanatory copy.

## 4. Supabase And Docs

- [x] 4.1 Add a Supabase migration to promote existing `admin@example.com` and update `private.is_dataset_admin()`.
- [x] 4.2 Update database security tests for `super_admin` access and spoofing boundaries.
- [x] 4.3 Update current-state docs for first super-admin bootstrap behavior.

## 5. Tests And Verification

- [x] 5.1 Add or update direct tests for role helpers, validation, analytics, user-management helpers, APIs, account disable, and UI states.
- [x] 5.2 Run direct Vitest coverage for touched tests.
- [x] 5.3 Run `pnpm run smoke:check`, `pnpm run verify:fast`, and rerun `pnpm run verify:change`.
- [x] 5.4 Run `pnpm run verify:change:run` as the terminal gate.
