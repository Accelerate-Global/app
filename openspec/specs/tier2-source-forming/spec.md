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
The system SHALL retain a source ROP3 only when it resolves exactly and satisfies the approved conflict policy; invalid/conflicting source values remain raw evidence and block publication.

#### Scenario: Source ROP3 conflicts with crosswalk evidence
- **WHEN** a nonblank source ROP3 resolves in the taxonomy but disagrees with one unambiguous pinned tracking-ID crosswalk
- **THEN** the source value remains in raw evidence and the candidate records a blocking conflict
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
