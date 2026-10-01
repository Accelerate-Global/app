## Context

Dataset handlers use a privileged server Postgres connection and check only the requested dataset's `is_workspace_visible` flag. A derived dataset's rows are read from `backing_dataset_id`, so a visible derived record can expose a restricted physical source. Direct Supabase clients use JWT-backed RLS; deleting `auth.sessions` and banning a user does not invalidate an already issued access token. The installed dependency tree also fails `pnpm audit --audit-level=high`.

## Goals / Non-Goals

**Goals:**
- Make effective dataset visibility depend on both the view and its physical source, for pages, APIs, saved tables, and direct RLS reads.
- Deny direct database and Storage access when the account is disabled or its JWT session no longer exists.
- Clear the repository's high-severity dependency audit while keeping application behavior stable.

**Non-Goals:**
- Introduce MFA, change role definitions, publish restricted data through sanitized derived copies, or change UI flows.
- Test production with real accounts or change provider settings outside the migration and normal release workflow.

## Decisions

1. Centralize an effective dataset-visibility predicate in server queries and a matching SQL condition in RLS. A non-admin must have access to the requested record and, for a derived view, its physical source. Admins retain their existing access. A read-time check closes any gap from legacy rows or mixed-version deployment.
2. Reject assignment of a visible view to a restricted source. When a physical source becomes restricted, hide visible derived views in the same database transaction. A database trigger enforces this invariant for all writers; the service returns a domain error for an invalid assignment. A migration hides any existing mismatched derived views before enabling the trigger. The visibility-to-Private-tag trigger remains authoritative for tags.
3. Add a `SECURITY DEFINER` helper that checks `auth.uid()`, the JWT `session_id`, an existing `auth.sessions` row for that user, and an existing unbanned `auth.users` row. Add a restrictive policy for `authenticated` on each app-owned public RLS table and `storage.objects`; existing permissive role and ownership policies continue to govern *what* an active user can access. Service-role operations bypass these policies. Existing local pgTAP identities will receive session fixtures and JWT claims.
4. Update direct and transitive package resolutions to patched compatible versions. Validate with the exact lockfile, package-dependent tests, application gates, and `pnpm audit --audit-level=high`.

## Risks / Trade-offs

- [Existing visible views backed by restricted data disappear for non-admin users] → Migrate them to restricted visibility and retain their contents for admins; document the count in migration verification.
- [Checking `auth.sessions` adds a database lookup to RLS evaluation] → Use a stable helper and `(select ...)` policy call pattern, then inspect local DB tests and query plans if a performance regression appears.
- [Legacy tokens without `session_id` lose direct data access] → Fail closed; current Supabase sessions carry the claim, and a normal re-login obtains a supported token.
- [Transitive overrides can break framework/workflow packages] → Run focused workflow tests and the repo's terminal verification gate on the exact resolved tree.

## Migration Plan

Apply the migration through the repo's migration workflow, validate locally, and deploy the application change through the normal release path. The migration first restricts existing invalid derived views, then installs the trigger and session policies. Rollback of SQL policies/helper/trigger is possible with a new migration; the visibility corrections must be reviewed before any reversal. Local Supabase is required for RLS verification and must be stopped and cleaned up afterward.

## Open Questions

None; the security boundary fails closed for derived views and revoked sessions.
