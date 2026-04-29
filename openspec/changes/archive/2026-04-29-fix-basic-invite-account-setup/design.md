## Context

Workspace invites create Supabase Auth users and immediately assign
`raw_app_meta_data.workspace_role`. The Basic role guard then blocks changes to
email and user metadata for users whose old or new role is `basic`.

Supabase invite links establish an authenticated callback session before the
user sets a password. The current invite redirect points to `/`, so invited
users see sign-in instead of the existing password setup UI. If they fall back to
sign-up, Supabase tries to update the already-created Auth user and the Basic
guard can reject that update.

## Goals / Non-Goals

**Goals:**

- Let invited Basic users complete initial account setup and password creation.
- Keep post-activation Basic restrictions on profile name, email, saved-table
  creation, and self-disable behavior.
- Reuse the existing reset-password page as the password setup surface for
  invite callbacks.
- Cover the behavior with OpenSpec, Vitest, and Supabase database security tests.

**Non-Goals:**

- Do not change role labels or admin role-management permissions.
- Do not weaken allowlist enforcement for normal sign-up.
- Do not mutate production user state during implementation.

## Decisions

- Redirect admin invites to `/reset-password` instead of `/`.
  - Rationale: Supabase invite links create a session-like callback suitable for
    `auth.updateUser({ password })`, and the app already has a password setup
    form for authenticated recovery sessions.
  - Alternative considered: create a separate invite-accept page. That would
    duplicate session restoration and password update logic without changing the
    underlying Auth behavior.
- Treat reset-password callback parameters generically, while keeping recovery
  copy and analytics unchanged for invalid non-invite recovery links.
  - Rationale: invite and recovery links both need to restore a Supabase session
    before the password update form is usable.
  - Alternative considered: special-case only `type=invite`; this is narrower
    but makes future Auth callback types harder to support.
- Relax the database trigger only for pending invited Basic users completing
  initial setup.
  - Rationale: the protection should start after the account has completed the
    invite lifecycle, not before the user can join.
  - Alternative considered: assign Basic role only after first login. That would
    allow a short-lived Pro-equivalent session and complicate admin-visible role
    state.

## Risks / Trade-offs

- Pending-invite predicate is too broad -> database tests verify active Basic
  users remain blocked from metadata and email-change updates.
- Invite callback shape differs between hosted and local Supabase -> reset form
  continues to support code, hash session, and existing session restoration.
- Production project missing `/reset-password` redirect allowlist -> deployment
  must ensure Supabase Auth redirect URLs include the app’s reset-password path.
