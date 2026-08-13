## MODIFIED Requirements

### Requirement: Pipeline resources use typed immutable packages
The system SHALL maintain source aliases, JP PeopleID3, PEID, Tier 1 merge
priorities, and engagement mappings as complete typed immutable AX Online
versions with deterministic checksums and expected-current activation, and SHALL
NOT read them from an AX Data root or sibling-repository manifest.

#### Scenario: Current resource package is reviewed
- **WHEN** an administrator submits a complete package through its owning AX Online workflow
- **THEN** validation creates an immutable candidate before any activation
- **AND** successful expected-current activation creates a healthy resource set

#### Scenario: Current resource package is partial or invalid
- **WHEN** a submitted package fails schema, uniqueness, or cross-resource validation
- **THEN** it remains inactive and cannot join a resource set

## REMOVED Requirements

### Requirement: Retained pipeline resources import as exact complete snapshots
**Reason**: The AX Data manifest importer violates the hard execution boundary.
**Migration**: Delete the importer and use built-in or administrator-submitted current AX Online resource versions.
