## Context

The ROP builder intentionally converts a small number of missing ROP2 parent links into structured `missing-rop2` warnings. The application and specifications accept those candidates, but the production `rop_reference_people_join_issue_check` constraint predates that warning value and rejects the projection insert. The refresh transaction therefore rolls back and the UI correctly retains the active version.

Resource lifecycle screens currently expose internal version numbers and use retrieval-oriented wording. User Management already uses trusted `raw_app_meta_data.workspace_role` authorization, but only supports invite, role/status mutation, resend, and password reset.

## Goals / Non-Goals

**Goals:**

- Make warning-only ROP refreshes persist successfully without changing validation thresholds or activation behavior.
- Present resource freshness as an `Updated` timestamp and remove active-version labels from user-facing components.
- Add a safe permanent account deletion flow available only to super admins.
- Correct the closed invite-role label and align the invite action with its controls.
- Cover the migration, API, domain guards, and UI states with regression tests and smoke contracts.

**Non-Goals:**

- Automatically activate refreshed ROP candidates.
- Hide or reinterpret genuine refresh failures.
- Change the stored `source_retrieved_at` schema/API field name; only user-facing wording changes.
- Add bulk deletion, self-service deletion, audit analytics, or deletion access for standard admins.

## Decisions

### Extend the existing join-issue constraint with a forward migration

The migration will drop and recreate `rop_reference_people_join_issue_check` with the existing values plus `missing-rop2`. This keeps the column bounded to recognized structured states while making the database agree with the already-specified application behavior. Removing the constraint entirely was rejected because it would weaken projection integrity.

### Keep candidate activation explicit

The refresh continues to create a reviewable candidate. Warning-only candidates remain eligible for an administrator to activate, while the active pointer remains unchanged on transaction or validation failure. Automatically accepting a refresh was rejected because source changes require explicit review.

### Change presentation language without renaming persisted fields

Screens will render only `Updated <timestamp>` for lifecycle freshness and omit active version numbers. Internal `source_retrieved_at`, version IDs, and checksums remain available to lifecycle and integrity code. A database/API rename was rejected because it adds migration risk without user value.

### Perform deletion through a server-only Supabase admin path

`DELETE /api/admin/users/:userId` will use the existing admin route wrapper, then require `super_admin` in the domain layer. Before hard-deleting the Auth user, it revokes the user's sessions; after deletion it removes the normalized email from the signup allowlist. The service-role client stays server-only. Soft deletion was rejected because the requested outcome is account removal and soft deletion is irreversible while retaining an obfuscated record.

### Protect administrative continuity

Deletion is blocked for the current actor and for the last active super admin. The confirmation dialog identifies the target account and requires a second explicit action. The UI hides deletion from standard admins, but the server independently enforces every protection.

## Risks / Trade-offs

- **[Existing access token may remain valid briefly after user deletion]** → Revoke Auth sessions before deletion and rely on existing server authorization checks; never expose this operation client-side with a service key.
- **[Auth deletion succeeds but allowlist cleanup fails]** → Return a normalized error and make the cleanup idempotent so an operator can safely retry; sequence mutations and tests to minimize residue.
- **[Constraint migration drifts from application enums again]** → Add schema and database regression assertions for `missing-rop2` and keep unknown values rejected.
- **[Destructive action is triggered accidentally]** → Hide it from non-super-admins, prohibit self/last-super-admin deletion, and require a dedicated confirmation dialog.

## Migration Plan

1. Apply the forward Supabase migration before or with the application deployment.
2. Verify the constraint accepts `missing-rop2` and continues rejecting unknown values.
3. Deploy the UI/API changes; no backfill is required because the failed candidate transaction did not replace the active version.
4. Retry the ROP refresh. It creates a new candidate and leaves activation explicit.

Rollback can restore the previous constraint only after confirming no stored projection rows use `missing-rop2`; the application deployment can be rolled back independently, but doing so would reintroduce the refresh failure.

## Open Questions

None. Account deletion is defined as a hard delete with explicit safeguards, and resource version data remains internal.
