## Context

Workspace authorization currently resolves `admin`, `pro`, and `basic` from
Supabase Auth app metadata. `identity.isDatasetAdmin` and the private database
helper grant admin-capable access only to `admin`, while User Management lets
admins invite and update the existing role set.

## Goals / Non-Goals

**Goals:**
- Add `super_admin` as a trusted app-metadata role.
- Preserve current admin permissions for standard admins except across the
  super-admin boundary.
- Keep app and database admin-capability checks aligned.
- Promote an existing `admin@example.com` account when the migration runs.

**Non-Goals:**
- No hard-delete workflow for users.
- No authorization based on user-editable metadata.
- No new auth provider, deployment process, or browser smoke role.

## Decisions

- Store `super_admin` in `workspace_role`.
  - Rationale: role display, filtering, analytics, validation, and writes already
    use one canonical app-metadata field.
  - Alternative considered: a separate flag layered onto `admin`; rejected
    because it would split authorization state across metadata keys.
- Make admin-capable checks role-based.
  - Rationale: `admin` and `super_admin` should both pass existing admin gates,
    while only super admins can cross the new User Management boundary.
  - Alternative considered: update each admin route separately; rejected because
    centralized helpers already define the boundary.
- Enforce super-admin mutation rules server-side.
  - Rationale: UI controls are convenience only; the API helper must prevent
    standard admins from assigning or changing super admins.
  - Alternative considered: hide the option only in the client; rejected because
    direct API calls would bypass it.
- Promote Blake through migration only if the Auth user exists.
  - Rationale: this matches existing first-admin bootstrap behavior without
    creating an Auth user or provider state from migrations.

## Risks / Trade-offs

- Existing active invite-resend work touches the same files -> integrate with
  current code and avoid reverting unrelated edits.
- Local database tests require Supabase services -> use repo verification
  commands and stop repo-local services before finishing.
- Existing sessions may keep old JWT app metadata until refresh -> server and DB
  reads from Auth tables still protect admin APIs, and UI reflects refreshed
  identity on next session update.

## Migration Plan

- Add a Supabase migration that updates `admin@example.com` to
  `workspace_role = 'super_admin'` when present.
- Replace `private.is_dataset_admin()` so both `admin` and `super_admin` pass.
- Rollback, if needed, is a follow-up migration that demotes Blake back to
  `admin` and restores admin-only helper semantics.

## Open Questions

- None.
