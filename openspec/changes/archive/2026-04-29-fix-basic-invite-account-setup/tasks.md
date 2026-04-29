## 1. Planning

- [x] 1.1 Run `pnpm run verify:change` and `pnpm run task:kickoff` for the auth, admin, Supabase, and OpenSpec paths.
- [x] 1.2 Create OpenSpec proposal, design, spec delta, and task artifacts for the Basic invite setup change.

## 2. Auth Flow

- [x] 2.1 Change admin workspace invites to redirect to `/reset-password`.
- [x] 2.2 Update reset-password session restoration so invite callbacks can show the password setup form.
- [x] 2.3 Add Vitest coverage for invite redirect and invite callback restoration behavior.

## 3. Database Guard

- [x] 3.1 Create a Supabase migration that permits initial pending-invite Basic setup while preserving later Basic profile-update denial.
- [x] 3.2 Update database security tests for pending invited Basic setup, active Basic profile denial, and admin/service app metadata updates.

## 4. Verification

- [x] 4.1 Run direct changed-area tests for auth/admin helpers and reset-password behavior.
- [x] 4.2 Run required repo gates: `pnpm run spec:validate`, `pnpm run typecheck`, `pnpm run verify:test-delta`, `pnpm run verify:app`, `pnpm run db:security`, `pnpm run db:check-migration-drift`, and `pnpm run verify:change:run`.
