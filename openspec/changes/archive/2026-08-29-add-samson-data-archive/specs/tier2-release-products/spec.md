## MODIFIED Requirements

### Requirement: Product rollback restores consumer-visible dataset contents
Tier 2 and Aggregate 2 rollback SHALL restore a hot retained or verified rehydrated publication's exact rows and blob through stable dataset-version history in the same transaction that validates and advances the target pointer.

#### Scenario: Incident publication is rolled back
- **WHEN** an administrator selects a hot prior publication and the expected-current target still matches
- **THEN** consumers read the prior publication's exact rows and checksum from the stable dataset
- **AND** the incident dataset version, publication, and audit evidence remain available
- **AND** the stable target keeps its pre-rollback workspace visibility

#### Scenario: Administrator selects a cold product publication
- **WHEN** an administrator selects a prior publication whose rows or artifact bundle remain cold on Samson
- **THEN** rollback is unavailable until an operator rehydrates and verifies the exact package
- **AND** the target pointer and stable dataset remain unchanged

#### Scenario: Rehydrated product publication is rolled back
- **WHEN** an operator has rehydrated the exact cold publication and the administrator supplies a still-current expected target
- **THEN** the system repeats the complete artifact, row, checksum, visibility, and target validation before restoring it
- **AND** the cold package remains immutable

#### Scenario: A new release launches after rollback
- **WHEN** a newer incident publication remains in history but the stable target points to the restored publication
- **THEN** the launch snapshot and Aggregate 2 member selection use the restored target publication and checksum
- **AND** they do not reselect the incident publication merely because it was created later

#### Scenario: Target advances during rollback review
- **WHEN** the target no longer matches the rollback request's expected-current publication
- **THEN** neither stable dataset contents nor the target pointer changes
