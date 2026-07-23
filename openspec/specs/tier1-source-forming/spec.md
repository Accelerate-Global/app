# tier1-source-forming Specification

## Purpose
Define versioned forming contracts for every Tier 1 source so readable source rows are normalized consistently with pinned geography, ROP, identity-support, type, and provenance resources.
## Requirements
### Requirement: Every Tier 1 source has a versioned forming contract
The system SHALL provide registered deterministic forming engines for Accelerate-owned, Etnopedia, IMB, Joshua Project, and WCD source profiles with versioned field, type, stable-key, country, ROP, duplicate, and provenance rules.

#### Scenario: Tier 1 source candidate builds
- **WHEN** a successful engine-managed import has complete checksummed artifacts and all declared resources
- **THEN** its source engine produces ordered curated rows, findings, lineage, and checksum bound to exact source/resource/contract versions
- **AND** does not allocate AX identity or publish automatically

### Requirement: Source formation preserves readable rows and evidence
The system SHALL preserve every structurally readable source row and original raw evidence while reporting unresolved geography, ROP, type, schema, and domain values through structured findings.

#### Scenario: Country or ROP cannot resolve
- **WHEN** a source country, ISO3, or ROP3 value has no unambiguous exact pinned match
- **THEN** the row remains in the candidate with the source value and a finding
- **AND** the system does not invent, fuzzily match, or silently drop the row

### Requirement: Contract-declared semantic values fail closed
The system SHALL treat invalid numeric, boolean, and datetime conversions and missing values declared required by the mapped field contract as blocking errors while preserving the readable source row and raw evidence.

#### Scenario: A mapped semantic value cannot be converted
- **WHEN** a nonblank mapped value is invalid for its declared numeric, boolean, or datetime type
- **THEN** the candidate retains the row with an `invalid-source-value` error
- **AND** the candidate is invalid until the source value or contract is corrected

#### Scenario: A required mapped value is blank
- **WHEN** a mapped field marked required has no nonblank converted value
- **THEN** the candidate retains the row with a `missing-required-mapped-value` error
- **AND** the candidate is invalid until the required source value is supplied

### Requirement: Stable source identity is mandatory
The system SHALL construct `Dataset_Row_Key` from a durable source-profile key and provider/source record identifier, and SHALL reject positional or snapshot-derived identity as an authoritative fallback.

#### Scenario: Source has durable unique identifier
- **WHEN** every row supplies a valid unique identifier allowed by its source contract
- **THEN** the candidate records stable deterministic row keys and source lineage

#### Scenario: Durable identity is missing or duplicated
- **WHEN** a row lacks its required stable identifier or two rows produce the same source row key
- **THEN** the candidate records blocking findings and cannot be published

#### Scenario: A source connection is replaced after an earlier publication
- **WHEN** a reviewed candidate pins an existing current source publication but its replacement connection has no dataset target
- **THEN** publication resolves and reuses the stable dataset from the pinned publication lineage
- **AND** it rejects mismatched producer, source profile, publication target, engine, dataset state, row count, or conflicting connection target instead of creating a duplicate visible dataset

### Requirement: Complete person-country duplicates block publication
The system SHALL identify duplicate nonblank canonical `(PG_ROP3, Geo_ISO3)` domain keys within one source candidate as blocking conflicts.

#### Scenario: Duplicate complete key appears
- **WHEN** two source rows resolve to the same nonblank ROP3 and ISO3
- **THEN** both rows remain inspectable with conflict findings
- **AND** the candidate is invalid until the source conflict is resolved

### Requirement: Tier 1 identity enrichment preserves formed lineage
An identity-enriched Tier 1 publication SHALL reference every output row's exact formed source publication and authoritative AX registry binding without modifying the formed candidate.

#### Scenario: Identity-enriched source publishes
- **WHEN** an administrator publishes a valid identity candidate
- **THEN** each row includes canonical PGAC/PGIC values and source-binding lineage
- **AND** downstream merge eligibility references the identity publication and registry revision
