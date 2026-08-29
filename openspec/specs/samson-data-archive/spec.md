# samson-data-archive Specification

## Purpose
Define AX Online's single-site Samson recovery system: complete nightly Supabase snapshots, encrypted deduplicated retention, compact receipt cataloging, fail-closed API-artifact archiving, recovery verification, capacity protection, and explicit safeguards against unapproved production pruning.

## Requirements
### Requirement: Samson creates complete nightly recovery snapshots
The system SHALL run an outbound-only backup from an isolated Samson guest at 2:00 AM in `America/Los_Angeles` and SHALL include the production database schema, data, Auth and account records, migration history, every Supabase Storage bucket, object metadata, and a canonical recovery manifest.

#### Scenario: Nightly backup succeeds
- **WHEN** the scheduled 2:00 AM backup can read every required database and Storage source
- **THEN** it commits one timestamped encrypted Restic snapshot with a complete canonical manifest
- **AND** records the source project, database version, migration state, object counts, byte counts, and completion time

#### Scenario: Required source is incomplete
- **WHEN** any required database export, Auth/account export, bucket inventory, object download, or manifest reconciliation is incomplete
- **THEN** the run fails without publishing a successful receipt
- **AND** no production payload becomes eligible for pruning

#### Scenario: Samson is temporarily offline
- **WHEN** the scheduled time passes without a completed run
- **THEN** the system records or detects a missed recovery point after Samson becomes available
- **AND** emits a sanitized missed-run alert

### Requirement: Recovery snapshots deduplicate and compress unchanged data
The Samson repository MUST encrypt backup content and SHALL use content-addressed deduplication and compression so unchanged database and file content is not stored as complete dated duplicates.

#### Scenario: Two unchanged backups run consecutively
- **WHEN** a second backup contains the same Storage objects and materially unchanged database content as the preceding run
- **THEN** the second snapshot references existing repository content
- **AND** reports the added unique bytes, deduplication ratio, and compression ratio

#### Scenario: One archived object changes
- **WHEN** a later snapshot includes a changed or newly created object
- **THEN** the repository stores only content chunks not already present
- **AND** both old and new recovery snapshots remain independently restorable

### Requirement: Snapshot and archive retention preserve long recovery history
The system SHALL retain 30 daily, 13 weekly, and 12 monthly project recovery snapshots and MUST retain every cataloged long-term archive package indefinitely while that package remains part of the archive catalog.

#### Scenario: Snapshot retention runs
- **WHEN** the repository applies its forget and prune policy
- **THEN** the required daily, weekly, and monthly recovery points remain available
- **AND** no cataloged archive package loses its last reachable content

#### Scenario: Archive package is older than one year
- **WHEN** a cataloged archive package is no longer referenced by a retained dated recovery snapshot
- **THEN** the current archive tree continues referencing its unique content
- **AND** repository pruning does not remove it

### Requirement: Backup manifests reconcile database metadata and Storage objects
Each successful recovery snapshot SHALL include a deterministic manifest that binds database export checksums to the exact bucket, path, size, content type, provider metadata, and verified local checksum of every required Storage object.

#### Scenario: Provider inventory changes during backup
- **WHEN** the Storage inventory differs between the pre-dump and post-copy inventory passes
- **THEN** the backup reconciles the final set or fails as inconsistent
- **AND** it never reports a successful snapshot with a missing required object

#### Scenario: Downloaded object fails verification
- **WHEN** a local object size or checksum differs from the recovery inventory
- **THEN** the run fails with a normalized integrity reason
- **AND** the mismatched object is not accepted into a verified archive package

### Requirement: Supabase stores a compact protected archive catalog
The system SHALL retain compact hot metadata for verified Samson packages and SHALL restrict archive control records to trusted server and administrator access without storing archived payload bodies, local filesystem paths, repository credentials, or recovery keys in Supabase.

#### Scenario: Samson submits a successful receipt
- **WHEN** a signed receipt identifies a verified snapshot and manifest
- **THEN** the trusted application boundary records the package identity, source identities, checksums, counts, sizes, lifecycle state, and verification timestamps
- **AND** browser roles receive no direct table privilege

#### Scenario: Receipt signature is invalid
- **WHEN** a caller submits an absent, expired, replayed, or invalid receipt signature
- **THEN** the request is rejected without cataloging the package or changing pruning eligibility

#### Scenario: Admin views cold history
- **WHEN** a dataset administrator views history whose payload is archived on Samson
- **THEN** the application shows safe metadata and a `cold` recovery state
- **AND** it does not disclose Samson addressing, paths, credentials, or artifact contents

### Requirement: Hot-data pruning is dependency-aware and operator-approved
The system MUST fail closed when evaluating archive eligibility and SHALL delete hot Supabase payloads only through an explicit operator action that repeats dependency, retention, receipt, checksum, and restore-verification checks against the reviewed plan.

#### Scenario: Historical package is eligible
- **WHEN** a package is older than 30 days, is not among the latest three valid versions, has no active or unfinished dependency, and has verified archive, integrity, and restore evidence
- **THEN** the dry-run plan may identify its exact database rows and Storage objects as eligible
- **AND** no deletion occurs until an operator approves that exact plan and checksum

#### Scenario: Historical package remains referenced
- **WHEN** a package is active, current, target-selected, among the last three valid versions, or referenced by an open run, candidate, publication, release, resource set, registry revision, or downstream lineage edge
- **THEN** it is ineligible for pruning regardless of its age or archive status

#### Scenario: Eligibility changes after review
- **WHEN** a dependency or target changes after the operator reviews a prune plan
- **THEN** the commit-time recheck rejects the stale plan
- **AND** no payload covered by the stale plan is removed

#### Scenario: Storage deletion partially fails
- **WHEN** an approved prune removes some named hot objects but another removal fails
- **THEN** the package is not falsely marked fully cold
- **AND** the operation remains safely retryable from recorded per-object state

### Requirement: Cold API-run packages rehydrate before application use
The initial system SHALL provide an operator-only workflow that restores a selected cold API-run package from Restic, verifies it completely, writes it to collision-free hot identities, and records rehydration before any application download consumes the payload. Dataset-version and pipeline-publication payloads SHALL remain hot until a separately released rehydration workflow passes its direct revert and target-aware rollback tests.

#### Scenario: Operator rehydrates a cold API-run package
- **WHEN** an authorized operator selects a cataloged cold API-run package
- **THEN** the workflow restores and verifies its manifest, rows, and objects before writing hot state
- **AND** records the new hot identities without mutating the archived evidence

#### Scenario: Rehydrated package fails verification
- **WHEN** restored content does not match the cataloged manifest or checksum
- **THEN** rehydration fails without exposing a download or advancing a publication target
- **AND** emits a sanitized integrity alert

#### Scenario: Browser requests cold payload directly
- **WHEN** a browser or application route requests a payload that is still cold
- **THEN** the route reports that operator rehydration is required
- **AND** it does not attempt a runtime connection from Vercel to Samson

#### Scenario: Dataset or publication package is considered for cold transition
- **WHEN** the initial rollout evaluates dataset-version or pipeline-publication evidence
- **THEN** the payload remains hot even when a verified Samson package exists
- **AND** the system requires a separate rehydration implementation and direct revert or rollback tests before enabling that cold lane

### Requirement: Free-tier headroom is measured and protected
Every successful or failed backup cycle SHALL measure live Supabase database and Storage usage and SHALL report warning status at 350 MB database or 750 MB Storage and critical status at 425 MB database or 900 MB Storage.

#### Scenario: Usage enters warning range
- **WHEN** either live usage measure meets its warning threshold
- **THEN** the system emits a deduplicated sanitized capacity alert
- **AND** produces or refreshes an archive eligibility report

#### Scenario: Active working set remains critical after verified pruning
- **WHEN** no eligible historical payload can bring a critical usage measure below its warning threshold
- **THEN** the system reports that the active working set no longer fits the free-first design
- **AND** requires a separate paid-Supabase versus Samson self-hosting decision

### Requirement: Recovery is continuously verified
The archive SHALL be considered usable only when automated integrity checks and periodic restore drills prove that database, Auth/account, migration, catalog, and Storage content can be reconstructed coherently.

#### Scenario: First production pruning is considered
- **WHEN** the system has not yet completed a full isolated restore of a complete snapshot
- **THEN** every production prune remains disabled

#### Scenario: Quarterly recovery drill succeeds
- **WHEN** an operator restores a retained snapshot into an isolated environment
- **THEN** database and Auth/account counts, migration state, bucket/object counts, representative checksums, and application health checks match the recovery manifest
- **AND** temporary recovery services and plaintext staging data are removed afterward

#### Scenario: Repository integrity check fails
- **WHEN** Restic reports missing, corrupt, or unreadable repository content
- **THEN** pruning and retention garbage collection stop
- **AND** a sanitized high-severity alert is emitted

### Requirement: Recovery status states the single-site limitation
The system MUST describe the Samson archive as single-site recovery until a physically separate repository is configured and verified.

#### Scenario: Operator reviews recovery status
- **WHEN** an operator reads the backup summary or recovery runbook
- **THEN** it states that mirrored disks protect against a single drive failure but not loss of the Samson server or site
- **AND** it does not claim off-site or geographic disaster recovery

#### Scenario: No off-site destination exists
- **WHEN** a nightly or monthly snapshot succeeds only on Samson
- **THEN** the snapshot is reported as locally protected and off-site unprotected
- **AND** the local backup still satisfies the approved current scope
