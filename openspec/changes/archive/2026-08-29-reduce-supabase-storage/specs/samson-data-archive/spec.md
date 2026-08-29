## ADDED Requirements

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

## MODIFIED Requirements

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

### Requirement: Free-tier headroom is measured and protected
Every successful or failed backup cycle SHALL measure live Supabase database and Storage usage and SHALL report warning status at 350 MiB database or 750 MiB Storage and critical status at 425 MiB database or 900 MiB Storage. Every protected prune plan SHALL report current Storage bytes, planned removal bytes, projected Storage bytes, and the selected retention profile.

#### Scenario: Usage enters warning range
- **WHEN** either live usage measure meets its warning threshold
- **THEN** the system emits a deduplicated sanitized capacity alert
- **AND** produces or refreshes an archive eligibility report using the explicitly configured retention profile

#### Scenario: Reviewed plan reaches the warning target
- **WHEN** a protected plan's exact eligible objects would bring current Storage below the configured warning threshold
- **THEN** the plan reports that projection and retains it in the canonical checksum
- **AND** deletion still requires all restore and operator approval gates

#### Scenario: Active working set remains critical after verified pruning
- **WHEN** no eligible historical payload under the bounded capacity profile can bring a critical usage measure below its warning threshold
- **THEN** the system reports that the active working set no longer fits the free-first design
- **AND** requires a separate paid-Supabase versus Samson self-hosting decision
