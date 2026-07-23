## ADDED Requirements

### Requirement: Resource sets satisfy registered engine declarations
The system SHALL validate an immutable resource set against a registered engine's ordered resource requirements before a candidate build starts.

#### Scenario: Resource set is complete for an engine
- **WHEN** every required resource key resolves to a valid active version of a compatible kind and schema with a deterministic checksum
- **THEN** the system returns the exact version bindings for candidate persistence

#### Scenario: Resource set is incomplete for an engine
- **WHEN** any required resource key is missing, invalid, incompatible, or absent from the selected immutable set
- **THEN** the resource set is not usable for that engine build
- **AND** the system reports the missing or incompatible keys

### Requirement: Pipeline resources use typed immutable packages
The resource catalog SHALL support the approved source-alias, JP PeopleID3, PEID, Tier 1 merge-priority, and engagement-mapping families with typed schemas, deterministic checksums, and validation appropriate to their key relationships.

#### Scenario: Valid pipeline resource is built
- **WHEN** a source package conforms to its registered schema, uniqueness rules, active-state rules, and cross-reference requirements
- **THEN** the system persists a valid immutable candidate with typed projections, artifacts, counts, checksum, and diff

#### Scenario: Pipeline resource contains blocking key defects
- **WHEN** a source package contains duplicate canonical keys, invalid identifiers, incompatible schema, or a blocking cross-reference defect
- **THEN** the candidate remains invalid and cannot join an active resource set

#### Scenario: Approved bounded parent is absent
- **WHEN** a resource family permits a documented bounded missing-parent relationship
- **THEN** the candidate records a warning and remains eligible when all other blocking invariants pass

### Requirement: Retained pipeline resources import as exact complete snapshots
The system SHALL import source aliases, JP PeopleID3, PEID, Tier 1 merge priorities, and engagement mappings from an explicit manifest of exact paths, SHA-256 checksums, and retrieval timestamps, SHALL persist each full typed payload and lineage as an immutable version, and SHALL NOT select a latest file.

#### Scenario: All retained snapshots match the manifest
- **WHEN** all five exact files match their declared checksums and pass schema, uniqueness, and cross-resource validation
- **THEN** the system creates all five immutable candidates before activating any of them
- **AND** expected-current activation produces a healthy immutable resource set containing every required family

#### Scenario: One retained snapshot drifts or fails validation
- **WHEN** any declared file is missing, checksum-mismatched, partial, or invalid
- **THEN** the import fails closed before activating any candidate
- **AND** no sanitized fixture is substituted for the retained production snapshot
