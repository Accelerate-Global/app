# tier2-source-forming Specification

## Purpose
Define deterministic engagement-partner forming from stable profiles, typed tracking contracts, pinned crosswalks, and exact AX registry revisions before review and publication.
## Requirements
### Requirement: Partner profiles form from exact typed contracts
The system SHALL form each engagement-partner snapshot from a stable profile, durable source key, versioned field/type contract, typed tracking-ID discriminator, and exact Country/ROP/PeopleID3/PEID/source-alias bindings.

#### Scenario: Tracking type resolves uniquely
- **WHEN** the configured discriminator and pinned crosswalk identify one approved person/ROP value
- **THEN** the candidate records the resolved value and exact resource lineage

#### Scenario: Tracking type is unknown or ambiguous
- **WHEN** the discriminator is unsupported or a crosswalk returns zero/multiple incompatible values
- **THEN** the candidate preserves the source row with a blocking finding and does not guess

#### Scenario: Resources or registry advance after candidate build
- **WHEN** active Country, ROP, or AX registry revisions advance after a Tier 2 forming candidate is built
- **THEN** identity reconciliation uses the exact version identifiers and checksums captured by that candidate
- **AND** it does not resolve replacement current inputs

#### Scenario: Partner source initials are resolved for identity
- **WHEN** a partner candidate is formed and sent to the shared AX identity registry
- **THEN** its partner key resolves to exactly one active entry in the pinned source-alias resource
- **AND** the source-alias version ID, checksum, canonical key, and initials are captured in the immutable identity input snapshot and fingerprint

#### Scenario: Partner source alias is missing or mismatched
- **WHEN** the partner key has no unique active alias or the pinned version, checksum, key, or initials no longer match
- **THEN** forming or identity build stops with a configuration error
- **AND** the system does not synthesize initials or fall back to a different source alias

### Requirement: Existing ROP3 values are validated
The system SHALL retain a source or approved current crosswalk ROP3 only when it resolves exactly in the pinned taxonomy, SHALL write that match's canonical ROP parents, and SHALL keep invalid or conflicting values as raw evidence that blocks publication.

#### Scenario: Source ROP3 resolves exactly
- **WHEN** one exact active ROP3 match exists
- **THEN** the formed row receives that ROP3 and its canonical ROP1, ROP2, and ROP25 values

#### Scenario: Source ROP3 conflicts with current crosswalk evidence
- **WHEN** a nonblank source ROP3 disagrees with one unambiguous independently current tracking-ID crosswalk
- **THEN** both values remain raw evidence and the candidate records a blocking conflict
- **AND** neither value silently replaces the other

### Requirement: Tier 2 uses the shared AX registry
The system SHALL reuse existing shared canonical identities or allocate through the same non-recycling registry namespace used by Tier 1.

#### Scenario: Partner row matches existing identity
- **WHEN** normalized source evidence identifies an existing canonical subject without conflict
- **THEN** the identity candidate reuses it and creates one stable partner source binding

### Requirement: Formed-source publication uses expected-current serialization
Each Tier 2 forming candidate SHALL capture its target's current publication and SHALL validate that exact expected value while holding a per-target transaction lock during publication.

#### Scenario: A competing candidate publishes first
- **WHEN** two candidates captured the same target publication and one publishes first
- **THEN** the second candidate fails its commit-time expected-current comparison
- **AND** it does not overwrite or silently supersede the first publication

### Requirement: Formed-source publication attempts are recoverable and owner-bound
Each Tier 2 formed-source publication SHALL record a bounded attempt lease and
attempt-owned blob, and commit SHALL require the exact attempt token that claimed
the candidate.

#### Scenario: An interrupted attempt exceeds its lease
- **WHEN** a formed-source publication remains `publishing` beyond the lease without committing a publication
- **THEN** the system returns the candidate to `valid` and deletes the attempt-owned blob
- **AND** a later reviewed attempt can claim and publish the candidate

#### Scenario: A stale attempt reaches commit
- **WHEN** an earlier attempt tries to finalize after its lease ownership changed
- **THEN** commit fails without creating or advancing the formed-source publication

### Requirement: Tier 2 onboarding creates exact feed profiles
The system SHALL create a Tier 2 profile from the exact reviewed Sheet tab, durable row-key column, typed tracking-ID column, owner key, unique feed key, and active engagement-mappings contract before the initial import starts.

#### Scenario: Tier 2 feed is configured during onboarding
- **WHEN** all required reviewed fields resolve and the owner has one active source alias
- **THEN** the connection and feed profile are committed atomically
- **AND** the linked connection uses PGAC classification

#### Scenario: Active engagement contract is unavailable
- **WHEN** the active engagement-mappings resource is missing, invalid, or ambiguous
- **THEN** Tier 2 onboarding fails before creating the connection or profile

### Requirement: One owner can manage multiple Tier 2 feeds
The system SHALL permit multiple active Tier 2 profiles to share one owner/partner key while requiring each profile key and Sheet-tab identity to remain unique.

#### Scenario: Accelerate owns two engagement feeds
- **WHEN** Final-58 and Final-Sudan use distinct profile keys and exact Sheet tabs with the same active Accelerate owner key from the source registry
- **THEN** both profiles are valid Tier 2 release members
- **AND** identity reconciliation resolves the shared owner through the same pinned source alias

#### Scenario: Duplicate feed identity is submitted
- **WHEN** another profile uses an existing profile key or exact spreadsheet/tab identity
- **THEN** the system rejects it without altering existing profiles

### Requirement: Existing connections can receive exact Tier 2 profiles
The system SHALL allow an administrator to configure an unassigned existing Google Sheets connection as a Tier 2 feed using its exact Sheet identity, reviewed durable row key, tracking field and fixed or row-specific source contract, owner key, unique feed key, and active engagement contract.

#### Scenario: Existing engagement dataset is linked
- **WHEN** an administrator submits a complete Tier 2 assignment for an ordinary active connection
- **THEN** the system creates one active Tier 2 profile and changes the linked dataset classification to PGAC in the same transaction
- **AND** it does not import, form, publish, or allocate an identity as part of the assignment

#### Scenario: Feed profile conflicts
- **WHEN** the feed key, exact spreadsheet/tab identity, owner alias, or required reviewed field is invalid or conflicts with an active profile
- **THEN** the request fails without creating a profile or changing dataset classification

### Requirement: Mixed tracking sources resolve explicitly per row
The system SHALL support a reviewed tracking-source column with an exact mapping from source values to supported identity types and SHALL NOT use a fallback type for unmapped values.

#### Scenario: Row has a reviewed tracking-source value
- **WHEN** a Tier 2 row's discriminator exactly matches a configured normalized source value
- **THEN** the forming engine resolves that row using the mapped PeopleID3, PEID, ROP3, or provider-native identity type
- **AND** records the resolved type in the formed output and later identity evidence

#### Scenario: Row tracking source is blank or unknown
- **WHEN** a row-specific profile receives a blank or unmapped tracking-source value
- **THEN** the forming engine records a blocking finding for that row
- **AND** does not infer a type from the tracking ID, evidence columns, or neighboring rows

### Requirement: Tier 2 source rows use permanent source-owned IDs
The system SHALL require a reviewed, populated, unique permanent source-row ID column and SHALL NOT substitute row positions, mutable names, or tracking IDs.

#### Scenario: Permanent ID is missing or duplicated
- **WHEN** a source row has a blank permanent ID or multiple rows share one ID
- **THEN** the forming candidate is invalid and identifies every affected row

### Requirement: Tier 2 geography is canonical before identity assignment
The system SHALL resolve source country text and current crosswalk geography through the exact pinned country resource and SHALL provide canonical ISO3 or a blocking unresolved/ambiguous finding before PGIC identity assignment.

#### Scenario: Country name resolves without source ISO3
- **WHEN** a Tier 2 row has one uniquely recognized current country name and no ISO3
- **THEN** forming writes its canonical ISO3 and exact country resource lineage

#### Scenario: Canonical geography remains unavailable
- **WHEN** neither source nor approved current crosswalk evidence resolves one canonical ISO3
- **THEN** a PGIC-classified identity row remains unassignable and no registry number is consumed for it
