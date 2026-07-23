## ADDED Requirements

### Requirement: Tier 2 release union binds every intended partner
The system SHALL finalize Tier 2 only from an exact complete partner publication release and SHALL concatenate rows in deterministic member/row order with provenance.

#### Scenario: Canonical identity duplicates across partners
- **WHEN** two release rows share a canonical PGIC
- **THEN** both remain inspectable with blocking findings and the candidate cannot publish

### Requirement: Aggregate 2 Combined Release uses exact supplements
The system SHALL build Aggregate 2 Combined Release from exact Tier 2, IMB, and JP publication identifiers rather than independently resolving current/latest inputs.

#### Scenario: Supplemental source advances
- **WHEN** IMB or JP publishes a newer version after the Aggregate 2 release is finalized
- **THEN** the existing union remains unchanged and is marked out of date

### Requirement: Product naming communicates union semantics
The system SHALL describe Tier 2 and Aggregate 2 outputs as provenance-preserving unions unless a future version implements a reviewed grouping rule.

#### Scenario: Administrator reviews product
- **WHEN** the run detail or dataset metadata is shown
- **THEN** it does not claim duplicate consolidation or grouped aggregation

### Requirement: Tier 2 product targets use expected-current publication
The system SHALL capture the current stable target publication when a Tier 2 or Aggregate 2 candidate is built and SHALL compare that expected value again inside serialized publish and rollback transactions.

#### Scenario: Target advances after review
- **WHEN** another publish or rollback advances the target after candidate review
- **THEN** the stale operation fails without overwriting the newer target
- **AND** the immutable candidate and publication history remain available

### Requirement: Product publication verifies complete immutable artifact evidence
Tier 2 and Aggregate 2 publication SHALL authenticate the immutable columns,
top-level manifest checksum, required artifact audit records and bodies, stored
rows, row count, and output checksum before replacing the stable dataset.

#### Scenario: Reviewed columns or an artifact manifest is tampered
- **WHEN** any column, manifest entry, artifact body, audit checksum, stored row, row count, or output checksum no longer agrees with the reviewed evidence
- **THEN** publication fails before a dataset blob or stable target is changed

### Requirement: Final product datasets are workspace-visible
Tier 2 and Aggregate 2 definitions SHALL declare their final stable datasets as
workspace-visible, while intermediate formed partner sources remain private.

#### Scenario: A final product publishes
- **WHEN** a valid Tier 2 or Aggregate 2 candidate commits
- **THEN** its stable dataset is workspace-visible according to the immutable definition contract

### Requirement: Product rollback restores consumer-visible dataset contents
Tier 2 and Aggregate 2 rollback SHALL restore the selected publication's exact rows and blob through stable dataset-version history in the same transaction that validates and advances the target pointer.

#### Scenario: Incident publication is rolled back
- **WHEN** an administrator selects a prior publication and the expected-current target still matches
- **THEN** consumers read the prior publication's exact rows and checksum from the stable dataset
- **AND** the incident dataset version, publication, and audit evidence remain available
- **AND** the stable target keeps its pre-rollback workspace visibility

#### Scenario: A new release launches after rollback
- **WHEN** a newer incident publication remains in history but the stable target points to the restored publication
- **THEN** the launch snapshot and Aggregate 2 member selection use the restored target publication and checksum
- **AND** they do not reselect the incident publication merely because it was created later

#### Scenario: Target advances during rollback review
- **WHEN** the target no longer matches the rollback request's expected-current publication
- **THEN** neither stable dataset contents nor the target pointer changes
