## ADDED Requirements

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
