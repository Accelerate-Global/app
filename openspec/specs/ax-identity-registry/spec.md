# ax-identity-registry Specification

## Purpose
Define the durable AX identity registry that allocates collision-free PGAC and PGIC codes, preserves aliases and history, and supports reviewed migration from legacy identities.
## Requirements
### Requirement: AX canonical and alias codes are globally collision-free
The system SHALL store PGAC/PGIC canonical and alias codes in one private registry that prevents one code from identifying multiple active subjects.

#### Scenario: Canonical or alias collision is attempted
- **WHEN** a transaction attempts to assign a code already used as canonical or alias by another identity
- **THEN** the database rejects the transaction
- **AND** existing identities and history remain unchanged

### Requirement: ROP3 identity is deterministic and validated
The system SHALL construct ROP3-backed PGAC/PGIC codes from the ROP3 entry's canonical pinned ROP1 parent, the reviewed establishing source initials, exact six-digit current ROP3, and canonical current ISO3. Missing source ROP1 SHALL be replaced by the ROP3 resource parent before code construction; a ROP3 without a valid parent SHALL block assignment.

#### Scenario: Valid ROP3 identity is requested twice
- **WHEN** the same exact current ROP3 and ISO3 are reconciled repeatedly or by another current source
- **THEN** the system returns the existing PGAC/PGIC identities and creates only the required source binding
- **AND** creates no duplicate canonical code or allocation

#### Scenario: Source ROP1 conflicts with current ROP3 parent
- **WHEN** formed ROP1 differs from the exact pinned ROP3 parent
- **THEN** identity assignment uses the resource-derived parent and records or preserves the discrepancy finding
- **AND** refuses an unexplained formed-contract mismatch

#### Scenario: Current ROP3 has no valid ROP1 parent
- **WHEN** ROP3 resolves but its pinned resource entry has no valid ROP1
- **THEN** the row is unassignable and no `00` fallback, identity, or code is created

### Requirement: Six-digit allocation is atomic and non-recycling
The system SHALL allocate no-ROP3 identifiers from a transactionally locked counter beginning at `000001`, SHALL validate the complete proposed code against all owned code values, and SHALL never derive from an unlocked maximum or recycle allocated, skipped, cancelled, rejected, or superseded values.

#### Scenario: Concurrent requests allocate different rows
- **WHEN** two transactions request new identities in the same namespace
- **THEN** each receives a unique collision-free six-digit value

#### Scenario: Required classification cannot be completed
- **WHEN** a row lacks a stable key or a PGIC-classified row lacks canonical ISO3
- **THEN** it remains unassignable and consumes no registry number

#### Scenario: ROP1 is unavailable without ROP3
- **WHEN** a complete allocatable row has neither valid ROP3 nor canonical ROP1
- **THEN** the code uses the established `00` ROP1 representation and records a visible finding

### Requirement: Registry revisions are immutable publication anchors
The system SHALL create an append-only checksummed registry revision only when authoritative identity graph content changes and SHALL allow data-only publications to reuse the current exact revision.

#### Scenario: Identity graph changes
- **WHEN** reviewed publication activates a new or changed identity, code, evidence owner, binding, or supersession
- **THEN** the database creates one revision and publication anchor atomically with actor, reason, and time

#### Scenario: Identity graph is unchanged
- **WHEN** all rows reuse existing bindings and only non-identity data changes
- **THEN** the identity publication reuses the current revision and consumes no number
- **AND** an identical source and output is idempotent

### Requirement: Tier 1 releases pin registry revision
Every Tier 1 merge release SHALL bind one immutable AX registry revision compatible with all source identity publications.

#### Scenario: Source identities use different revisions
- **WHEN** selected input publications cannot be reconciled to the chosen registry revision
- **THEN** the release cannot finalize

### Requirement: Registry spans Tier 1 and Tier 2
The authoritative AX Online registry SHALL prevent canonical, alias, ROP3-evidence, and allocated-value collisions across Tier 1 and Tier 2 while preserving distinct current source-profile row bindings.

#### Scenario: Tier 2 current ROP3 matches Tier 1
- **WHEN** a Tier 2 row has the same exact validated ROP3 and ISO3 as an active Tier 1 identity
- **THEN** it reuses the shared PGAC/PGIC and records a distinct Tier 2 source binding

#### Scenario: Current ROP3 conflicts with another active identity
- **WHEN** an exact current ROP3 is already claimed by an incompatible active identity
- **THEN** publication is blocked and neither identity is silently rewritten

### Requirement: Established AX code format remains authoritative
The system SHALL format PGAC as `<ROP1 suffix>-<registered source initials>-<ROP3 or six-digit allocation>` and PGIC by appending `-<ISO3>`, with all inputs normalized through checksummed AX Online contracts.

#### Scenario: Complete current evidence is formatted
- **WHEN** canonical inputs are ROP1 `A010`, source `jp`, ROP3 `100001`, and ISO3 `LAO`
- **THEN** PGAC is `10-jp-100001` and PGIC is `10-jp-100001-LAO`

#### Scenario: ISO3 is unavailable
- **WHEN** PGAC evidence is complete but canonical ISO3 is absent
- **THEN** PGAC may be assigned for a PGAC-classified row but no PGIC or fabricated geography is created

### Requirement: Existing bindings change only through reviewed current evidence
The system SHALL preserve an active source binding through ordinary field changes and SHALL require an explicit reviewed decision for changes to ROP1, source, ROP3, ISO3, or real-world identity.

#### Scenario: Ordinary data changes
- **WHEN** a tracked row changes only non-identity fields
- **THEN** its binding and AX codes remain unchanged

#### Scenario: Identity component changes
- **WHEN** current normalized evidence changes an identity component
- **THEN** the candidate shows current and proposed evidence and cannot alter authority until an administrator approves a supported rebind, new identity, or canonical supersession
