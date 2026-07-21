## Why

The ROP refresh now produces a documented warning value that the production database still rejects, so otherwise valid HIS data cannot be persisted for review. Resource metadata and User Management also expose avoidable friction: internal version language is shown to users, the invite role is inconsistently cased, and super admins cannot permanently remove accounts.

## What Changes

- Update the ROP projection database constraint so the bounded `missing-rop2` warning can be stored without weakening the existing validation tolerance or automatic activation safeguards.
- Simplify resource metadata to show `Updated` timestamps without exposing active version numbers.
- Show canonical role labels in the closed invite-role selector and align the invite action with its form controls.
- Add a confirmed, super-admin-only account deletion flow that revokes sessions, removes the Supabase Auth account and signup allowlist entry, and protects the current user and last active super admin.
- Preserve the currently active ROP resource whenever a refresh genuinely fails; this change does not auto-activate newly refreshed candidates.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `reference-resources`: Simplify visible lifecycle metadata to updated timestamps without internal active-version labels.
- `rop-code-resource`: Persist bounded missing-ROP2 warning rows successfully while retaining current hierarchy validation and active-version safety.
- `workspace-role-permissions`: Allow only super admins to permanently delete eligible workspace accounts through an explicit confirmation flow.

## Impact

- **Data integrity / Supabase:** adds a forward migration for `private.rop_reference_people.join_issue`; the service-role-only account deletion path mutates Supabase Auth sessions, users, and the signup allowlist.
- **Auth / admin permissions / API contract:** adds `DELETE /api/admin/users/:userId`, enforced server-side as super-admin-only with self-deletion and last-active-super-admin protections.
- **UI:** updates resource catalog/detail metadata and User Management controls. Existing page smoke markers remain; the new confirmation dialog receives explicit smoke markers.
- **Vercel:** no platform configuration change; the deployed refresh route will use the migrated database constraint.
- **Non-goals:** no automatic ROP activation, no change to missing-parent tolerance thresholds, no deletion access for standard admins, and no attempt to infer general user activity beyond existing last-sign-in data.
