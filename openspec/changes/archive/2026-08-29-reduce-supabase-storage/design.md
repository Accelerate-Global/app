## Context

Supabase reports 1,149,585,042 bytes across 435 Storage objects. API-run artifacts account for 1,082,709,659 bytes; database usage is only about 260 MiB. AX Online already creates complete encrypted Restic snapshots on Samson, but API packages are created only after 30 days, the prune planner retains the latest three successful runs per connection, and no production package has `restore_verified_at` evidence. The present strict plan therefore cannot delete anything, and even the 30-day candidates cannot return Storage below the configured critical band.

The implementation spans the Samson worker, private Supabase archive catalog, operator CLI, pruning policy, and recovery runbook. Browser roles remain outside the archive-control boundary. Supabase Storage deletion continues through the Storage API, consistent with current provider guidance; SQL is used only for read-only inventory and private catalog transactions.

## Goals / Non-Goals

**Goals:**

- Prove that exact API-run packages can be restored from Restic and verified before any hot object is deleted.
- Preserve an auditable operator, request key, checksum, outcome, and completion time for each package verification.
- Keep the existing 30-day/latest-three retention defaults, while allowing a bounded 7-day/latest-one capacity profile when explicitly configured on Samson and in the reviewed prune environment.
- Project the post-prune Storage total in the protected plan and fail when the plan does not match current policy or inventory.
- Move only dependency-free API-run artifacts cold; retain their content indefinitely through Samson's existing content-addressed Restic tree.
- Return production Storage below the warning threshold without removing database rows, accounts, dataset payloads, or publication payloads.

**Non-Goals:**

- Live-object coalescing across active run manifests. Shared content-addressed hot objects require a complete per-run ownership graph before they can be pruned safely.
- Dataset-version or pipeline-publication rehydration.
- Automatic capacity-triggered deletion, browser-triggered recovery, Vercel-to-Samson access, off-site protection, or changes to Auth and admin authorization.

## Decisions

### Add a restore-only package verification command

The Samson-only command restores one exact `api-run` package from its cataloged Restic snapshot into the existing restricted staging workspace. It validates the package key, source checksum, canonical manifest checksum, catalog member identities, sizes, and SHA-256 checksums, then removes staging content. It does not upload, rewrite, or delete Supabase Storage objects.

On success it inserts an immutable private verification record and sets the package's `restore_verified_at` timestamp in one transaction. On failure it records a normalized failure and leaves prune eligibility false. This closes the current circular gap in which rehydration requires an already-cold package but pruning requires prior restore evidence.

Alternative considered: treat the successful full-project restore as proof for every package. Rejected because it did not exercise the package include path or reconcile each package manifest to its catalog members.

### Use explicit bounded retention configuration

Add `DATA_ARCHIVE_API_MIN_AGE_DAYS` (7–30, default 30) and `DATA_ARCHIVE_API_HOT_VERSIONS` (1–3, default 3). The same parsed policy drives package creation, eligibility decisions, plan checksums, and apply-time rechecks. Production configuration changes are manual and reviewed; no email alert or browser request changes retention automatically.

The immediate capacity profile is 7 days/latest one. Current data shows that this profile can move enough dependency-free run history to Samson to return total Storage below the 750 MiB warning line while preserving every historical payload in the encrypted archive.

Alternative considered: keep latest three hot and rely on duplicate-object coalescing. Rejected for the incident response because shared chunk ownership is not yet represented for all active runs and an incorrect reference count could delete a chunk still used by another manifest.

### Bind capacity projection to the exact prune plan

The plan records policy values, current live Storage bytes, planned removal bytes, projected live Storage bytes, and the configured warning/critical thresholds. These fields are included in the canonical checksum. Apply reloads current inventory and policy, rejects stale plans, and uses the Storage API for exact named deletion.

### Keep deletion manual and fail closed

Package verification and plan generation are separate from prune approval. Applying a plan still requires the exact protected file, checksum, owner, `--approve`, and `DATA_ARCHIVE_PRODUCTION_PRUNE_ENABLED=true`. Dataset, publication, release, resource, registry, target, and shared-path checks remain authoritative even under the capacity profile.

## Risks / Trade-offs

- **[A 7-day/latest-one hot floor reduces instant download history]** → Cold metadata remains visible, Samson retains every version, and operator rehydration restores an exact package before download.
- **[Samson is single-site]** → Continue reporting off-site unprotected status; this change does not weaken or overstate that limitation.
- **[Policy differs between backup and prune hosts]** → Embed policy in packages and plans, centralize parsing, and reject apply-time policy mismatch.
- **[Storage changes between plan and approval]** → Bind the inventory and dependency state to the plan checksum and perform commit-time rechecks.
- **[A package restore consumes temporary plaintext space]** → Use the restricted staging directory, exclusive lock, checksum verification, and guaranteed cleanup.
- **[The retained hot set grows critical again]** → Capacity projection and subsequent alerts expose that condition; a paid-Supabase or broader self-hosting decision remains separate.

## Migration Plan

1. Add the private RLS-enabled verification audit table, Drizzle schema, tests, CLI, policy configuration, and plan fields.
2. Run local OpenSpec, unit, migration, database-security, and terminal verification gates.
3. Deploy the migration and code, then update the Samson worker checkout/config without enabling pruning.
4. Run a normal backup with the 7-day/latest-one profile so all candidate packages are cataloged.
5. Verify each package selected by the dry-run through the restore-only command and confirm staging cleanup.
6. Generate and owner-review the exact plan; require projected usage below the warning threshold.
7. Enable pruning only for that approved invocation, apply it, disable the gate, run another backup, and confirm live capacity plus package rehydration behavior.

Rollback: disable the capacity profile and pruning gate, rehydrate any cold package through the existing operator workflow, and retain all Samson snapshots and audit evidence. Schema additions are additive and need not be removed.

## Open Questions

None. The production profile remains an explicit operator setting and automatic deletion remains disabled.
