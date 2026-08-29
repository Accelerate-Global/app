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
The system MUST fail closed when evaluating archive eligibility and SHALL delete hot Supabase payloads only through an explicit operator action that repeats dependency, configured retention, receipt, checksum, inventory, and restore-verification checks against the reviewed plan. API-run retention SHALL default to 30 days and the latest three valid runs per connection, and SHALL accept only an explicitly configured bounded capacity profile no lower than 7 days and the latest one valid run per connection.

#### Scenario: Historical package is eligible
- **WHEN** a package is older than the configured minimum age, is outside the configured hot-version floor, has no active or unfinished dependency, and has verified archive, integrity, package-restore, and audit evidence
- **THEN** the dry-run plan may identify its exact Storage objects as eligible
- **AND** no deletion occurs until an operator approves that exact plan and checksum

#### Scenario: Historical package remains referenced
- **WHEN** a package is active, current, target-selected, inside the configured hot-version floor, or referenced by an open run, candidate, publication, release, resource set, registry revision, shared Storage owner, or downstream lineage edge
- **THEN** it is ineligible for pruning regardless of its age, capacity pressure, or archive status

#### Scenario: Retention profile is absent or invalid
- **WHEN** no capacity profile is configured or a configured age or hot-version floor is outside the supported bounds
- **THEN** the system uses the 30-day/latest-three defaults or fails configuration validation
- **AND** it never silently lowers retention

#### Scenario: Eligibility changes after review
- **WHEN** a dependency, target, policy, inventory, or capacity measure changes after the operator reviews a prune plan
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
Every successful or failed backup cycle SHALL measure live Supabase database and Storage usage and SHALL report warning status at 350 MiB database or 750 MiB Storage and critical status at 425 MiB database or 900 MiB Storage. Every protected prune plan SHALL report current Storage bytes, planned removal bytes, projected Storage bytes, and the selected retention profile. Database numeric representations used for Storage totals or object sizes MUST be accepted only when they represent an exact nonnegative safe integer and MUST be normalized before capacity calculation, canonical plan validation, and checksum creation.

#### Scenario: Usage enters warning range
- **WHEN** either live usage measure meets its warning threshold
- **THEN** the system emits a deduplicated sanitized capacity alert
- **AND** produces or refreshes an archive eligibility report using the explicitly configured retention profile

#### Scenario: Reviewed plan reaches the warning target
- **WHEN** a protected plan's exact eligible objects would bring current Storage below the configured warning threshold
- **THEN** the plan reports that projection and retains it in the canonical checksum
- **AND** deletion still requires all restore and operator approval gates

#### Scenario: Database returns a whole-number byte value as text
- **WHEN** PostgreSQL returns a current Storage total or eligible object size as a decimal digit string within the safe-integer range
- **THEN** the planner normalizes it to the exact integer before calculating and checksumming the protected plan
- **AND** the resulting projection matches the same aggregate returned as a number

#### Scenario: Database returns an invalid capacity aggregate
- **WHEN** a capacity aggregate is missing, negative, fractional, malformed, or greater than the safe-integer range
- **THEN** plan generation fails without writing an approvable plan
- **AND** no Storage deletion occurs

#### Scenario: Active working set remains critical after verified pruning
- **WHEN** no eligible historical payload under the bounded capacity profile can bring a critical usage measure below its warning threshold
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

### Requirement: Samson Node workers remain compatible with service memory hardening
The scheduled backup, missed-run, package-verification, and rehydration workers MUST start under the configured prohibition on writable-executable memory and SHALL retain that protection in production. Provider-facing HTTPS used by those workers MUST avoid a runtime dependency on WebAssembly.

#### Scenario: Hardened backup worker starts
- **WHEN** systemd starts the Node-based backup worker with writable-executable memory prohibited
- **THEN** the worker runtime starts without a V8 executable-memory failure
- **AND** the memory protection remains enabled

#### Scenario: Hardened missed-run worker starts
- **WHEN** systemd starts the Node-based missed-run checker with writable-executable memory prohibited
- **THEN** the checker completes its configured evaluation without a runtime executable-memory failure
- **AND** it preserves the same sanitized alert behavior

#### Scenario: Hardened package verification starts
- **WHEN** systemd starts an exact package restore-verification under the same memory protection
- **THEN** catalog lookup, Restic restore, checksum verification, and signed receipt submission complete without WebAssembly initialization
- **AND** temporary staging is removed

#### Scenario: Hardened rehydration starts
- **WHEN** systemd starts an approved exact API-package rehydration under the same memory protection
- **THEN** Restic verification plus exact Storage upload, conflict verification, and cleanup use a WebAssembly-free HTTPS path
- **AND** the memory protection remains enabled without exposing credentials or broadening the Storage target

### Requirement: API-run package restore evidence is independently verified
The system MUST provide an operator-only workflow that restores one exact verified API-run package from its cataloged Samson snapshot into private staging, validates its canonical manifest and every member against the protected catalog, removes staging content, and records immutable verification provenance before that package can become eligible for pruning.

#### Scenario: Package restore verification succeeds
- **WHEN** an operator approves verification of an exact API-run package and every restored manifest and member matches its cataloged identity, size, and checksum
- **THEN** the system records the request key, package, operator, manifest checksum, completion time, and verified outcome
- **AND** sets restore evidence for that package without writing to live Supabase Storage

#### Scenario: Package restore verification fails
- **WHEN** Restic cannot restore the selected package or any manifest, member, identity, size, or checksum differs
- **THEN** the system records a normalized failed outcome and removes temporary plaintext staging content
- **AND** the package remains ineligible for pruning

#### Scenario: Browser attempts package verification
- **WHEN** an ordinary browser or application route attempts to invoke package verification or inspect its protected provenance
- **THEN** no verification interface or direct table privilege is available
- **AND** Samson credentials, paths, and restored content remain undisclosed
