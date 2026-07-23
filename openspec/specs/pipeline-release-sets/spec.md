# pipeline-release-sets Specification

## Purpose
Define immutable release sets that bind every product build to exact source publications, resource versions, registry revisions, and rules before downstream processing or publication.
## Requirements
### Requirement: Release sets bind exact immutable inputs
The system SHALL finalize a release set only when every required named input publication, resource set, registry revision, and rule binding is present, checksummed, compatible, and immutable.

#### Scenario: Complete release finalizes
- **WHEN** an administrator selects one valid publication for each required input and the expected current bindings still match
- **THEN** the system stores an immutable canonical release checksum and ordered members

#### Scenario: Input is missing or stale
- **WHEN** a required publication is absent, checksum mismatches, or expected registry/resource state changed before commit
- **THEN** finalization fails without creating a usable release

#### Scenario: Source publications originate from sequential revisions
- **WHEN** the selected final registry revision is not older than every member's origin revision and contains every exact binding ID used by every member
- **THEN** the release may finalize even though the members have different origin revision IDs

#### Scenario: Final revision lacks a used binding
- **WHEN** the selected final registry revision is older than a member origin or omits/supersedes one of its exact bindings
- **THEN** finalization fails with revision-compatibility evidence and creates no usable release

### Requirement: Finalized releases never follow current datasets
The system SHALL resolve release inputs by immutable publication identifier and SHALL NOT substitute current dataset rows or a latest source.

#### Scenario: Source publishes later version
- **WHEN** a source target advances after release finalization
- **THEN** runs bound to the release still read the original artifacts
- **AND** the release is reportable as superseded without mutation

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

### Requirement: Coordinated release selection remains explicit and exact
The coordinator SHALL validate code-defined release completeness from exact publications but SHALL require an authorized explicit finalization decision before the release becomes usable.

#### Scenario: Candidate release is complete
- **WHEN** every configured source publication is present
- **THEN** the coordinator reports it ready for review rather than silently finalizing or following future publications

#### Scenario: Release review is rejected
- **WHEN** an administrator rejects the proposed release with a reason
- **THEN** the release domain records the rejection before the coordinator closes the stage
- **AND** no merge, aggregate, or publication stage becomes runnable
