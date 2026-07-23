## ADDED Requirements

### Requirement: Forming engines implement one immutable contract
The system SHALL register source-specific forming engines through one typed contract containing a stable engine key, supported source profile, version, deterministic checksum, artifact schema version, ordered resource requirements, and pure forming function.

#### Scenario: Registered source run is eligible
- **WHEN** an administrator starts forming from a successful import snapshot whose source profile maps to one registered engine
- **THEN** the lifecycle binds that engine's key, version, checksum, artifact schema, source artifacts, and resource requirements before executing the transform
- **AND** the engine returns generic rows, columns, findings, validation, lineage, and output-checksum data without publishing a dataset

#### Scenario: Source profile has no engine
- **WHEN** an administrator requests forming for an unsupported or ambiguously registered source profile
- **THEN** the system rejects the request without creating a publishable candidate
- **AND** existing datasets and candidate history remain unchanged

### Requirement: Generic forming candidates preserve immutable evidence
The system SHALL persist every forming candidate with exact source-artifact checksums, engine and contract bindings, ordered resource bindings, artifact-schema version, deterministic result metadata, and immutable private artifacts.

#### Scenario: Candidate finishes successfully
- **WHEN** a registered engine completes with internally consistent counts, lineage, artifacts, and checksum
- **THEN** the candidate finalizes as valid or invalid according to structured findings
- **AND** later source ingestions, resource activations, or engine releases do not alter its bindings or artifacts

#### Scenario: Artifact or checksum verification fails
- **WHEN** candidate persistence cannot verify an expected artifact, row count, lineage reference, or checksum
- **THEN** the candidate finalizes as failed or invalid with a normalized inspectable error
- **AND** it cannot be published

### Requirement: Candidate decisions and publication remain explicit
The system SHALL require administrator review and an explicit guarded decision before a formed candidate can become a workspace dataset, and SHALL preserve rejected, failed, invalid, and previously published history.

#### Scenario: Administrator publishes a valid candidate
- **WHEN** an administrator supplies a reason, acknowledges any warnings, and publishes a valid undecided candidate
- **THEN** the system revalidates immutable bindings and publishes through existing dataset version history
- **AND** records the actor, reason, dataset, output checksum, and publication time

#### Scenario: Candidate is not publishable
- **WHEN** an administrator attempts to publish an invalid, rejected, failed, stale, publishing, or already published candidate
- **THEN** the system rejects the transition without changing the target dataset

### Requirement: Historical IMB candidates remain compatible
The system SHALL read and operate existing IMB candidate records and artifacts after the generic forming platform is introduced.

#### Scenario: Existing IMB record lacks new generic columns
- **WHEN** the application reads a migrated historical IMB candidate
- **THEN** it resolves the backfilled IMB engine and Country/ROP bindings
- **AND** preserves the candidate's status, findings, artifacts, checksums, decisions, and dataset association
