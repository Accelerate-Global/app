## 1. Planning

- [x] 1.1 Run `pnpm run verify:change` and `pnpm run task:kickoff` before code edits; record DB and terminal verification requirements.
- [x] 1.2 Validate OpenSpec artifacts with `pnpm run spec:validate`.

## 2. Dataset boundary

- [x] 2.1 Enforce effective visibility of derived records and their physical sources across dataset and saved-table reads.
- [x] 2.2 Reject invalid derived assignments and atomically restrict dependent views when a source is restricted.
- [x] 2.3 Add direct application regression tests for restricted backing sources and derived visibility changes.

## 3. Supabase boundary

- [x] 3.1 Add a Supabase migration for source visibility invariants and active-session/account RLS and Storage enforcement.
- [x] 3.2 Extend pgTAP fixtures and assertions for active, disabled, revoked, and missing-session tokens.
- [x] 3.3 Run local database security and migration checks; stop repo-local Supabase services and clean transient Docker cache.

## 4. Dependencies and closure

- [x] 4.1 Update direct and transitive dependencies to clear the high-severity audit threshold.
- [x] 4.2 Run package-dependent direct tests and `pnpm audit --audit-level=high`.
- [x] 4.3 Rerun `pnpm run verify:change`, complete its required commands, and pass `pnpm run verify:change:run` on the candidate tracked tree.
- [x] 4.4 Verify implementation against this change and archive the OpenSpec change after all required verification passes.
