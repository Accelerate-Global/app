## 1. Planning Gates and Security Spikes

- [x] 1.1 Run `pnpm run verify:change` and `pnpm run task:kickoff -- --scope 'openspec/changes/add-samson-data-archive/**,src/lib/data-archive/**,src/app/api/internal/archive-receipts/**,scripts/*archive*,scripts/*backup*,supabase/migrations/**,supabase/tests/database/**,docs/operations/**,config/change-impact*'`; record owned paths, unrelated dirty paths, required commands, targeted smoke coverage, and local Supabase needs.
- [x] 1.2 Add the archive/backup domain to `config/change-impact.ts` and its generated manifest with direct tests that require OpenSpec validation, unit tests, database security checks, smoke contract checks, and the terminal change gate when relevant files change.
- [x] 1.3 Prove against an isolated/local Supabase instance that a dedicated Postgres backup role can export the required public, private, Auth, Storage-metadata, and migration schemas without write privileges; document exact grants and negative mutation tests.
- [x] 1.4 Prove that an Auth service identity with server-controlled backup-reader app metadata can list and download every required private bucket through an RLS-scoped S3 session while upload, replace, move, and delete operations fail.
- [x] 1.5 Stop for explicit security approval if either spike requires a production database credential or full-access Storage key; do not provision privileged production credentials under this plan without that approval.

## 2. Archive Catalog and Database Contracts

- [x] 2.1 Create a Supabase migration for compact backup runs, archive packages, package members, receipts, verification states, prune plans/items, and rehydration records with bounded normalized fields and stable state constraints.
- [x] 2.2 Add indexes, foreign keys, immutable-evidence guards, expected-state transitions, and retention constraints that prevent a package from becoming verified, cold, or rehydrated without its required evidence.
- [x] 2.3 Enable RLS or revoke browser roles for every archive table; add only the narrowly required trusted-server functions or grants and keep authorization data in app metadata rather than user metadata.
- [x] 2.4 Add pgTAP coverage for direct browser denial, receipt replay rejection, immutable package evidence, stale prune plans, dependency pins, partial deletion state, and rehydration transitions.
- [x] 2.5 Update `src/db/schema.ts` and same-stem schema or migration tests for the new compact catalog without putting payload bodies, local paths, credentials, recipient addresses, or recovery keys in Postgres.

## 3. Canonical Manifests and Local Backup Engine

- [x] 3.1 Define versioned canonical schemas for project snapshots, Storage inventories, archive packages, signed receipts, capacity summaries, and prune plans; add deterministic serialization and SHA-256 tests.
- [x] 3.2 Implement a single-run lock, run workspace lifecycle, restrictive file modes, signal-safe failure handling, and guaranteed plaintext staging cleanup.
- [x] 3.3 Implement the Supabase-supported roles/schema/data/migration dump sequence with PostgreSQL 17 tooling and record tool/database versions and export checksums in the manifest.
- [x] 3.4 Implement pre-dump and post-copy Storage inventories plus incremental bucket synchronization, local hashing, count/size reconciliation, and a hard failure for any missing or mismatched object.
- [x] 3.5 Implement stable content-addressed archive package paths for API-run artifacts, dataset versions, and pipeline publications without date-based payload duplication.
- [x] 3.6 Implement encrypted Restic snapshot creation, compression/deduplication statistics, 30-daily/13-weekly/12-monthly retention, current-archive reachability protection, and bounded integrity checks.
- [x] 3.7 Add unit and fixture tests proving a second unchanged run adds no duplicate Storage payload, changed chunks remain independently restorable, cataloged archive content survives retention, and inconsistent inventories fail closed.

## 4. Samson Guest and Scheduling

- [x] 4.1 Add reviewed infrastructure documentation or reproducible provisioning assets for a dedicated minimal Samson backup guest; do not install backup dependencies directly on the Proxmox host.
- [x] 4.2 Create a dedicated ZFS dataset on `samson-backup` with compression, restrictive ownership, an initial 50 GB planning budget or quota, and warning/critical capacity thresholds without changing the existing `vzdump` dataset.
- [x] 4.3 Install and pin PostgreSQL 17 client tools, Supabase CLI, Restic, rclone or the approved Storage reader, and the backup runtime inside the guest; verify recorded checksums or package provenance.
- [x] 4.4 Configure root-only service credentials, receipt-signing material, Restic recovery access, and direct-alert credentials; verify none appear in shell history, process arguments, logs, manifests, Git, Supabase rows, or Vercel responses.
- [x] 4.5 Configure outbound-only network policy and trusted management access with no router port forwarding, public listener, Vercel-to-Samson request path, or worker-network attachment.
- [x] 4.6 Configure a systemd timer for 2:00 AM `America/Los_Angeles`, randomized bounded retry for transient failures, overlap prevention, missed-run detection, service hardening, and local log retention.
- [x] 4.7 Verify the live guest, timer, ZFS health, repository accessibility, clock/timezone, outbound TLS, and negative inbound reachability before enabling production credentials.

## 5. Signed Receipts, Status, and Alerts

- [x] 5.1 Implement an internal Vercel receipt route with timestamped signatures, bounded bodies, replay protection, stable idempotency, same-origin/security wrapper compliance where applicable, and no Samson address or path disclosure.
- [x] 5.2 Persist valid receipts into the compact archive catalog and make invalid, stale, duplicate-conflicting, or incomplete receipts unable to change verification or pruning state.
- [x] 5.3 Implement warning thresholds at 350 MB database and 750 MB Storage and critical thresholds at 425 MB database and 900 MB Storage, with current usage and archive-growth measurements attached only as safe numeric metadata.
- [x] 5.4 Route healthy-provider backup failures through the existing operational outbox and implement Samson's bounded direct Resend fallback for Supabase or receipt-path outages using the same destination and deterministic idempotency keys.
- [x] 5.5 Add direct tests for signed receipt authentication, replay handling, sanitized alert fields, cooldown/budget behavior, missed-run detection, capacity thresholds, and direct fallback without raw data or secrets.

## 6. Hot and Cold Application Behavior

- [x] 6.1 Extend API connection run repositories and DTOs with safe hot/cold/rehydrating/failed archive status while preserving current run ordering, timestamps, lineage, and authorization.
- [x] 6.2 Update API connection history and run detail to offer downloads only for hot payloads and show operator-rehydration guidance for cold payloads; add component tests and required smoke markers for any new surface.
- [x] 6.3 Extend dataset version history with compact cold metadata and stable rehydration-required outcomes while preserving existing admin-only mutation and viewer access rules.
- [x] 6.4 Update Tier 1 and Aggregate 1 rollback validation to reject cold evidence, accept only fully verified rehydrated evidence, and repeat current target/checksum/locking checks without changing the cold package.
- [x] 6.5 Update Tier 2 and Aggregate 2 rollback validation with the same cold/rehydrated guarantees and add direct rollback tests for stale targets and incomplete rehydration.
- [x] 6.6 Run `pnpm run smoke:check` after UI contract changes and update `tests/ui/route-registry.ts` or colocated smoke fixtures only when the changed surfaces require them.

## 7. Archive Eligibility and Operator Pruning

- [x] 7.1 Implement a read-only eligibility engine covering age, last-three-valid retention, active targets, open/retryable work, candidates, publications, releases, resource sets, registry revisions, storage ownership, and downstream lineage.
- [x] 7.2 Implement a deterministic dry-run CLI that prints only safe IDs, states, counts, byte totals, reasons, and a canonical plan checksum without deleting anything.
- [x] 7.3 Implement the operator-approved prune command with explicit plan/checksum confirmation, commit-time dependency rechecks, narrow database transactions, per-object Storage state, stable retry behavior, and no broad globs or unresolved paths.
- [x] 7.4 Add database and service tests proving active or newly referenced evidence cannot be pruned, the latest three valid versions remain hot, stale plans fail, shared paths remain, and partial Storage failures never produce a false cold state.
- [x] 7.5 Keep automatic production deletion disabled; any first production prune remains a separately reviewed operator action after the required restore gates pass.

## 8. Rehydration and Recovery Verification

- [x] 8.1 Implement an operator-only API-run rehydration CLI that restores one package to a protected temporary directory, verifies every manifest member, creates collision-free hot paths/identities, and cleans plaintext staging data on success or failure; keep dataset and publication cold transitions disabled.
- [x] 8.2 Implement trusted API-run database/object restoration with idempotent retry, immutable cold evidence, explicit rehydration records, and no consumer-visible change until the existing authorized download occurs.
- [x] 8.3 Add direct workflow tests proving cold API output and dataset-version requests stop before download/revert, cold Tier 1/Tier 2 publications stop before rollback, and only verified rehydrated evidence is accepted by the existing authorized action.
- [x] 8.4 Implement a complete isolated project-restore drill covering roles where supported, schema, data, Auth/account records, migration history, buckets, object counts, representative checksums, and application health assertions.
- [x] 8.5 Run the drill against local Supabase, stop all repo-local Supabase/Docker services afterward, run the required builder/image/container cleanup allowed by repo policy, and confirm persistent local volumes were preserved unless an explicitly approved reset was required.
- [x] 8.6 Record the completed isolated-restore and Restic measurements in the operator runbook, explicitly leaving production recovery point, runtime, ratios, and object throughput pending the first post-release production cycle.

## 9. Documentation and Initial Rollout

- [x] 9.1 Add `docs/operations/samson-data-archive.md` covering architecture, ownership, daily operation, credentials, rotation, recovery-key custody, single-site limitation, alerts, pruning, rehydration, complete restore, and emergency disablement.
- [x] 9.2 Update `docs/architecture/current-state.md`, `docs/operations/reference-resources.md`, relevant pipeline runbooks, and `docs/open-questions.md` to distinguish hot rollback, cold archive recovery, provider backup, and the unresolved lack of an off-site destination.
- [x] 9.3 Stage a fail-closed post-release activation sequence that runs two complete production backups without pruning, verifies their receipts/manifests, and records actual deduplication and compression before enabling the timer.
- [x] 9.4 Complete a full isolated restore and an independently restorable package/changed-content Restic fixture before enabling any production prune path.
- [x] 9.5 Keep scheduled observation and the first read-only API-artifact dry-run review as documented post-release operational gates; do not make them prerequisites for shipping the non-destructive backup worker.
- [x] 9.6 Keep every production prune disabled behind a separate explicit operator approval that is not granted by implementing or activating this backup change.

## 10. Required Verification and Change Closure

- [x] 10.1 Run `pnpm run verify:fast` and the direct unit/component tests mapped to every touched implementation file; fix product, test-gap, contract/harness, or environment failures before proceeding.
- [x] 10.2 Run `pnpm run spec:validate`, `pnpm run db:security`, `pnpm run smoke:check`, and any targeted browser smoke subset listed by `pnpm run verify:change`.
- [x] 10.3 Run `pnpm run verify:change:run` as the terminal gate for the candidate tracked tree; treat missing tests, skipped required checks, and repo-owned verification-tool failures as blockers.
- [x] 10.4 Re-run `pnpm run verify:change`, complete every required command it lists, and confirm Samson/Supabase service cleanup and preservation state are documented.
- [x] 10.5 Run `/opsx:verify` against this change, resolve every implementation/spec/design mismatch, then archive the completed OpenSpec change with `pnpm run spec:archive -- add-samson-data-archive` before any ship-local or release work.
