## 1. Planning and policy

- [x] 1.1 Run `pnpm run verify:change` and `pnpm run task:kickoff -- --scope 'src/lib/data-archive/**,scripts/data-archive-*,src/db/schema.ts,supabase/migrations/**,infra/samson/**,docs/operations/samson-data-archive.md'`; record the required commands, targeted smoke subset, and local Supabase need.
- [x] 1.2 Add bounded API artifact age/hot-version configuration with 30-day/latest-three defaults and direct configuration tests.

## 2. Package restore verification

- [x] 2.1 Create a Supabase migration and Drizzle schema for private immutable package-verification audit records, RLS, grants, constraints, and indexes.
- [x] 2.2 Implement restore-only API-package verification against Restic, catalog identity, manifests, member sizes, and checksums with guaranteed staging cleanup.
- [x] 2.3 Add the Samson-only verification CLI, environment gates, sanitized failure alerting, package script, and direct unit/contract tests.

## 3. Capacity-aware packaging and pruning

- [x] 3.1 Apply the same configured age policy to API-run package creation while leaving dataset and publication package policy unchanged.
- [x] 3.2 Apply configured age/hot-version floors and audit-backed restore proof to eligibility and apply-time stale-plan checks.
- [x] 3.3 Add current, removal, projected Storage bytes, thresholds, and selected policy to canonical protected prune plans and safe CLI output.
- [x] 3.4 Update archive, eligibility, prune, canonical, migration, and CLI tests for default, capacity, stale-policy, projection, and fail-closed cases.

## 4. Operations and repository verification

- [x] 4.1 Update Samson environment templates, deployment assets, and the recovery runbook for package verification and the reviewed 7-day/latest-one capacity profile.
- [x] 4.2 Run the direct tests and every command required by `pnpm run verify:change`, then run `pnpm run verify:change:run` successfully with repo-local Supabase stopped and cleaned afterward.
- [x] 4.3 Verify the implementation against the OpenSpec artifacts, archive the completed change, and pass `pnpm run verify:ship:local`.

## 5. Controlled rollout preparation

- [x] 5.1 Deploy the additive verification-audit migration with production pruning disabled, then confirm migration drift and Supabase advisors.
- [x] 5.2 Run the live read-only capacity profile plan, record safe counts and projection, and expose exact restore-required package keys only in the protected file.
- [x] 5.3 Enforce that an exact reviewed plan, checksum, operator, environment gate, current policy, current inventory, and current dependency state are required before Storage API deletion.
- [x] 5.4 Document the post-release backup, package verification, prune, rebackup, rehydration, capacity, alert, and protected-data confirmation sequence.
