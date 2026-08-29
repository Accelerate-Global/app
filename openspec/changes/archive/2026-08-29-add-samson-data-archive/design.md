## Context

AX Online is a Vercel-hosted Next.js application whose live data, Auth users, and file objects are in Supabase. The application deliberately keeps immutable dataset versions, run artifacts, reference-resource packages, pipeline publications, and rollback evidence. That history is valuable, but the live project currently uses approximately 272 MB of database space and 1.15 GB of Storage against an intended Supabase Free ceiling of 500 MB and 1 GB respectively. The `api-connection-artifacts` bucket accounts for approximately 1.08 GB and is the first pressure point.

Samson is the existing Proxmox host on the Bethany LAN. Its `samson-backup` ZFS pool is a healthy two-disk mirror with approximately 5.29 TiB available and Zstandard compression enabled. Samson has no public ingress requirement for this change. There is currently no physically separate off-site destination, so this design improves provider independence and drive-failure resilience but does not protect against loss of the entire Samson site.

Existing behavior assumes that historical evidence remains in Supabase and can be inspected or rolled back directly. The archive must therefore add explicit hot/cold state, safe dependency checks, and operator rehydration rather than silently deleting old objects. Current immutable-history, target compare-and-swap, RLS, and admin authorization rules remain authoritative.

## Goals / Non-Goals

**Goals:**

- Keep Vercel and Supabase as the live application, Auth, database, and short-retention file services while remaining within free-tier headroom.
- Make Samson the durable long-term authority for inactive history and the independent recovery source for the complete Supabase project.
- Run a complete, encrypted, compressed, deduplicated backup every day at 2:00 AM in `America/Los_Angeles`.
- Include database roles where exportable, schema, data, Auth users/account records, migration history, all Storage buckets, object metadata, and deterministic manifests.
- Store unchanged bytes once while preserving dated recovery snapshots and an indefinite archive of cataloged historical packages.
- Remove eligible payloads from Supabase only after fail-closed verification and explicit operator approval.
- Preserve administrator awareness of cold history and provide an operator-only, checksummed API-artifact rehydration path before download; dataset and pipeline payloads remain hot until their separately released rehydration workflows pass direct tests.
- Reuse the operational email destination for sanitized failure, missed-run, integrity, capacity, and restore alerts.
- Measure real backup size, deduplication, compression, runtime, and restoration time rather than relying on estimates.

**Non-Goals:**

- Moving the live Vercel application, Supabase Auth, or the active database to Samson in this change.
- Making Samson publicly reachable or allowing Vercel to query Samson during ordinary requests.
- Using Vercel Blob, Supabase paid backup add-ons, or another metered provider as the archive.
- Claiming geographically separate disaster recovery without an off-site destination.
- Automatically pruning payloads before at least one full restore drill passes.
- Pruning active reference projections, active datasets, open-run inputs, active candidates, current target publications, or the last three valid versions.

## Decisions

### 1. Use a pull-based, outbound-only Samson service

A dedicated minimal Linux guest on Samson runs the backup schedule and reaches Supabase and Vercel over outbound TLS. It does not listen on a public interface. Operator access is limited to the established trusted management path.

This avoids home-router port forwarding, public webhook authentication, and dependence on Supabase being able to initiate a connection to a residential network. A Supabase- or Vercel-triggered push was rejected because it would add public ingress and would fail when Samson is temporarily offline. A scheduled pull can retry safely and report a missed recovery point.

The guest, not the Proxmox host, owns PostgreSQL 17 client tools, the pinned Supabase CLI, rclone or an equivalent Storage reader, Restic, the backup scripts, and secrets. This keeps application dependencies and privileged provider credentials off the hypervisor.

### 2. Separate disaster-recovery snapshots from archival packages

Each daily run produces two related outputs:

1. A **project recovery snapshot** containing database exports, Auth/account data, migration history, Storage inventory, project configuration inventory, and a manifest. Snapshot retention is 30 daily, 13 weekly, and 12 monthly recovery points.
2. **Archive packages** for immutable historical units that are eligible to leave Supabase. Archive packages remain present in the current archive tree indefinitely while cataloged, so Restic snapshot expiration cannot garbage-collect their only copy.

Archive packages use stable domain identities and SHA-256 checksums rather than dates as payload keys. Dated manifests point to those stable payloads. Restic content-defined chunking, compression, and encryption then eliminate unchanged duplicate bytes across snapshots.

### 3. Produce a consistent database-and-object recovery boundary

The nightly sequence is:

1. Acquire a single-run lock and create a run identifier.
2. Record source project identity, Postgres version, migration state, and start time.
3. Export database roles where available, schema, data, Auth/account records, and migration history using the current Supabase-supported dump sequence.
4. Export a canonical Storage inventory containing bucket, path, object version metadata where available, size, content type, and database metadata.
5. Pull Storage objects into a current mirror, using a second inventory pass to close the window around the database snapshot.
6. Verify every object named by the recovery inventory exists locally with the expected size and checksum. Any object whose provider metadata does not expose a trustworthy content checksum is hashed locally.
7. Write a canonical manifest and summary, then commit the run to Restic.
8. Run a bounded Restic read/integrity check and record repository size statistics.
9. Submit a signed, sanitized receipt to the Vercel application for compact cataloging and operational status. If receipt delivery fails, the local backup remains valid but no Supabase pruning becomes eligible.

The database and Storage APIs do not provide one cross-service transaction. The two-pass object inventory and immutable object paths reduce that gap. Any mismatch fails the run and preserves all Supabase data.

### 4. Keep credentials least-privileged and fail closed

The implementation first attempts dedicated read-only credentials:

- A Postgres backup role with schema usage and read access needed to dump application, private, Auth, Storage metadata, and migration schemas.
- A dedicated Supabase Auth service identity whose server-controlled app metadata marks it as a backup reader, with Storage RLS granting read-only access to required buckets through an S3 session token.
- A signing key used only to authenticate backup receipts to Vercel.
- A dedicated Resend key or equivalent server-only credential scoped to the same operational destination for alerts that must still leave when Supabase is unavailable.

Supabase-generated S3 access keys bypass RLS and allow writes, so they are not the preferred steady-state credential. If a complete supported dump cannot be produced with a read-only database role, use of the production database credential on Samson requires an explicit implementation-time security review, root-only secret storage, outbound-only network policy, and a documented rotation procedure.

Restic repository encryption material is not stored in Git or Supabase. The owner keeps a recovery copy outside Samson, such as an existing password manager. Losing both Samson and the recovery key makes the archive unrecoverable.

### 5. Add a compact hot archive catalog

Supabase stores only small catalog/control records, not archived payloads. The catalog records:

- archive package ID, domain kind, source IDs, source checksum, row/object counts, and byte size;
- Restic snapshot and manifest identity without exposing repository credentials or local paths;
- archive completion, integrity-check, restore-check, pruning, and rehydration timestamps;
- the hot/cold state and any rehydrated replacement identity;
- the signed Samson receipt and normalized failure reason where applicable.

Browser roles receive no direct catalog-table or Storage privileges. Guarded admin routes expose only safe status and recovery guidance. The catalog remains small enough to preserve free-tier headroom.

### 6. Use dependency-aware, operator-approved pruning

Automated work identifies candidates and produces a dry-run plan. Actual deletion is an explicit operator CLI action in the initial release. A candidate is ineligible if it is:

- newer than 30 days;
- among the latest three valid versions for its recovery target;
- active, current, or selected by a stable target;
- referenced by an open or retryable run, candidate, publication, release, resource set, registry revision, or downstream lineage edge;
- missing a complete archive package, signed receipt, integrity pass, or restore pass;
- part of a backup run that has not been cataloged successfully.

The operator command repeats eligibility inside the deletion transaction, requires the reviewed plan/checksum, deletes only the named hot payloads, and marks the catalog entry cold. Storage deletion occurs only after database ownership/reference checks succeed. Partial failure remains retryable and never marks an object cold while a required hot dependency is missing.

The initial relief lane targets old unreferenced API-connection artifacts because they dominate current Storage. Dataset-version rows and pipeline publication evidence are added only after their rehydration and rollback tests pass.

### 7. Make cold history visible but operator-rehydrated

Existing admin history surfaces distinguish:

- **Hot:** payload is immediately inspectable/downloadable/rollback-ready.
- **Cold:** metadata remains visible, but payload use requires operator rehydration.
- **Rehydrating/failed:** a safe status explains that no download or rollback is available yet.

Rehydration is an operator-only CLI workflow, not a Vercel-to-Samson request. In the initial release it accepts only API-run packages: the operator selects an archive package, Restic restores it to a protected staging directory, checks the package and manifest, uploads objects to new collision-free paths, restores control records through trusted transactions, and records the result. Dataset-version and Tier 1/Tier 2 publication payloads remain hot; their cold transitions stay disabled until separately released rehydration workflows pass direct revert/rollback tests. Target-aware rollback still repeats expected-current checks after any future verified rehydration; rehydration alone never advances a stable target.

### 8. Reuse the operational email destination without creating a circular dependency

When Supabase is healthy, signed Samson receipts can enter the existing sanitized operational alert pipeline. When the failure is loss of Supabase or the receipt path itself, Samson sends a bounded direct Resend alert to the same configured destination. Direct alerts use fixed templates, deterministic idempotency keys, local rate limits, and no raw data, provider objects, credentials, filenames, or recovery keys.

Success email is optional and summarized; failures, a missed 2:00 AM run, integrity mismatch, failed rehydration, failed prune, database use above 350 MB, Storage use above 750 MB, or archive allocation above configured thresholds are alertable. The primary requirement is that silence is not treated as success.

### 9. Treat Samson as single-site recovery, not off-site recovery

The ZFS mirror protects against one disk failure, not fire, theft, destructive administrator action, or compromise of Samson. Status, documentation, and alerts must call the system `single-site` until an off-site destination exists. No second local copy on the same pool is described as off-site protection.

The repository layout and Restic initialization retain the ability to copy snapshots later to an external disk or remote repository with compatible chunking parameters. Adding that destination is deferred without blocking local archive delivery.

### 10. Keep full self-hosting behind a measured decision gate

The system records database and Storage usage after every run. Warnings begin before provider limits: 350 MB database and 750 MB Storage; critical status begins at 425 MB and 900 MB. If verified archive/pruning cannot keep the active working set below those levels, the next decision is either paid Supabase or a separately proposed self-hosted live data plane on Samson.

Moving the live system is not hidden inside this backup change because it would add public availability, Auth, email, database operations, patching, monitoring, and secure ingress responsibilities.

## Risks / Trade-offs

- **[Samson is the only independent copy]** → Report single-site status everywhere, retain the live Supabase hot set, use mirrored ZFS, keep the recovery key outside Samson, and preserve a clean future path to an external repository.
- **[Supabase is already over the intended Storage allowance]** → Prioritize the API-artifact archive lane, but prohibit deletion until the first complete backup and restore drill pass.
- **[Logical dumps and object copies are not atomic together]** → Use a consistent database dump, two-pass Storage inventory, immutable paths, manifest reconciliation, and fail the run on any mismatch.
- **[Backup credentials could mutate production]** → Prefer RLS-scoped Storage sessions and a dedicated read-only database role; require explicit review and isolation before accepting any privileged fallback.
- **[A compromised Samson receipt could authorize deletion]** → Keep deletion operator-approved, repeat all dependency and checksum checks in the trusted application/database boundary, and never accept a receipt alone as deletion authority.
- **[Restic retention could prune archive-only bytes]** → Keep every cataloged archive package referenced by the current archive tree and verify package reachability before `forget`/`prune`.
- **[A cold package can no longer serve an immediate browser download]** → Keep catalog metadata visible, explain the cold state, and require verified operator rehydration before use.
- **[Database active data may exceed 500 MB even after pruning]** → Alert early and trigger a separate paid-versus-self-hosted decision before read-only mode.
- **[Backup success can be falsely assumed from job exit alone]** → Require manifest reconciliation, Restic integrity checks, signed receipts, missed-run detection, and periodic restores.
- **[Operational alert delivery may share the failed provider]** → Give Samson a bounded direct email fallback to the same destination.

## Migration Plan

1. Add OpenSpec contracts, archive data model, security policies, impact rules, tests, and operator documentation without pruning any production data.
2. Provision the dedicated Samson guest and ZFS dataset; install pinned tooling and configure root-only secrets and outbound policy.
3. Run credential spikes proving complete read-only database and Storage export. Stop for security review if privileged credentials are required.
4. Restore a representative complete snapshot into an isolated local Supabase environment, verify Auth/account rows, application table counts, migrations, Storage object counts, and representative checksums, then shut down and clean up the temporary services.
5. Release the non-destructive backup worker and signed receipt route with the timer and production pruning still disabled.
6. Run the first complete production backup, a second materially unchanged backup, and record compression/deduplication statistics; only then enable nightly scheduling, missed-run monitoring, signed receipts, quota reporting, and operational email alerts. Continue with no pruning for an observation window.
7. Generate an API-artifact archive/prune dry run. Reconcile every dependency and restore a sample package.
8. With explicit operator approval, prune only the reviewed eligible API artifacts and verify the live application, history status, archive catalog, Storage usage, and rehydration path.
9. Expand eligibility to dataset and pipeline evidence only after their direct rehydration and rollback test suites pass.

Rollback is additive until step 8: disable the Samson timer and receipt endpoint without affecting production. After pruning begins, rollback means rehydrating the exact verified archive package; code rollback alone cannot recreate removed Supabase payloads. No migration or pruning task is complete until that recovery path has been demonstrated.

## Open Questions

- No off-site destination exists. Site-loss protection remains an accepted limitation until the owner identifies another physical location or remote server.
- The implementation spike must confirm whether Supabase permits a sufficiently complete logical backup, including Auth and required schema metadata, through a dedicated read-only database role. A privileged credential fallback is not pre-authorized by this plan.
- The initial UI can present cold state in existing history surfaces. A standalone archive browser is deferred unless direct operator experience proves the embedded status insufficient.
