## ADDED Requirements

### Requirement: Tier 2 releases enforce configured membership
The system SHALL compare selected partner inputs with the checked-in release definition and SHALL reject missing, duplicated, unexpected, or incompatible profile publications.

#### Scenario: Required partner is absent
- **WHEN** an administrator finalizes a release without one configured required partner
- **THEN** finalization fails and identifies the missing profile key

### Requirement: Tier 2 releases accept compatible sequential registry revisions
The system SHALL select one final registry revision that is not older than every member's origin revision and contains every exact identity binding used by every member.

#### Scenario: Sequential partner publications remain compatible
- **WHEN** partner publications have different origin revisions and the selected final revision contains all of their exact bindings
- **THEN** the release may finalize without requiring identical origin revision IDs

#### Scenario: Final revision omits a partner binding
- **WHEN** the final revision is older than a member origin or omits/supersedes one of its exact bindings
- **THEN** finalization fails and identifies the incompatible member
