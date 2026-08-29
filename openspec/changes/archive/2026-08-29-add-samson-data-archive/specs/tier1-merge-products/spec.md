## MODIFIED Requirements

### Requirement: Tier 1 product publication uses expected-current targets
The system SHALL capture the stable target's current publication ID when a candidate is built and SHALL compare that expected value again inside every serialized publish transaction. An exact rollback SHALL name a hot retained or verified rehydrated publication and the expected current publication, verify that the immutable rows/artifacts still match their reviewed checksum and target, repeat the expected-current check under the target publication lock, restore the stable dataset atomically, and append a new published run/publication without mutating prior evidence. Final Tier 1 and Aggregate 1 definitions SHALL explicitly publish workspace-visible datasets.

#### Scenario: Target advances after review
- **WHEN** another publication or exact rollback changes the stable target after the candidate was reviewed
- **THEN** the stale operation fails without overwriting the newer target
- **AND** all reviewed artifacts and lineage remain inspectable

#### Scenario: Operator restores an exact retained publication
- **WHEN** an administrator selects a hot retained publication owned by the same stable target and supplies the exact current publication ID and a reason
- **THEN** the system restores the retained publication's verified immutable rows to the stable dataset
- **AND** appends a new published rollback run and publication with the actor, reason, restored publication, and prior target recorded
- **AND** the retained and displaced publications remain immutable and inspectable

#### Scenario: Operator selects a cold publication
- **WHEN** an administrator selects a publication whose immutable payload is cold on Samson
- **THEN** rollback is unavailable until an operator rehydrates and verifies that exact publication
- **AND** rehydration alone does not advance the stable target

#### Scenario: Operator restores a rehydrated publication
- **WHEN** the exact cold publication has been rehydrated to collision-free hot identities and the expected current publication still matches
- **THEN** the normal checksum, target ownership, locking, and append-only rollback requirements apply
- **AND** the cold archive package remains immutable

#### Scenario: Rollback target changes during commit
- **WHEN** another operation advances the target after rollback review but before commit
- **THEN** the rollback fails without replacing the newer stable dataset
- **AND** any prepared storage object is removed

#### Scenario: An approved final product publishes
- **WHEN** a valid Tier 1 or Aggregate 1 candidate is published
- **THEN** its stable dataset is available through the normal workspace dataset list
- **AND** replacement publications preserve that definition-declared visibility

#### Scenario: Operator attempts a generic dataset mutation
- **WHEN** an operator attempts to replace rows, upload a row batch, change status, visibility, classification, or tags, delete the dataset, assign a backing dataset, or use upload-history revert on a dataset referenced by a pipeline publication
- **THEN** the generic mutation fails without changing the dataset or its publication lineage
- **AND** the operator is directed to use the target-aware Pipeline Products publication or rollback operation

#### Scenario: A Supabase role bypasses the application routes
- **WHEN** an authenticated, anonymous, or service-role client directly inserts, updates, reparents, or deletes a pipeline-owned dataset, row, version, or version row
- **THEN** database triggers reject the write for both the old and new parent identities
- **AND** only a direct trusted server transaction with a transaction-local publication capability may change protected content or lineage
- **AND** that capability cannot be executed by browser-facing or service roles and expires with its database transaction

#### Scenario: Migration encounters historical storage aliases
- **WHEN** multiple datasets already have archived versions that reference the same storage object path before the integrity ledger is installed
- **THEN** the migration records every exact path-and-dataset ownership pair without changing the datasets or their history
- **AND** each grandfathered owner may reuse that path while no unrecorded dataset can join the alias

#### Scenario: Concurrent publications claim a new storage path
- **WHEN** two datasets or archived versions attempt to become the first owner of the same previously unclaimed storage object path
- **THEN** exactly one dataset claims the path
- **AND** the other operation fails with a stable conflict without publishing aliased dataset state
- **AND** every claim survives dataset deletion so a deleted dataset identifier or its old paths cannot be revived

#### Scenario: Dataset identity reassignment targets a tombstone
- **WHEN** an operator or direct database client attempts to change a current dataset identifier, including changing its path to one historically claimed by that new identifier
- **THEN** the database rejects the update because dataset identifiers are immutable
- **AND** the current dataset cannot assume a deleted dataset identity or revive its tombstoned storage path
- **AND** atomic identity claims prevent a concurrent delete-and-reinsert race from reusing that identifier

#### Scenario: A deleted dataset still has referenced storage
- **WHEN** a generic dataset deletion evaluates its current and historical object paths
- **THEN** storage removal is attempted only for paths not referenced by any remaining current dataset, dataset version, committed pipeline publication, or required rehydration record
- **AND** a path permanently shared with another grandfathered owner is retained even when that owner has no live reference at deletion time
- **AND** a still-referenced path remains intact

#### Scenario: Publication response is retried after commit
- **WHEN** publication is requested again for a run that already has a committed publication
- **THEN** the service returns that published run without replacing the dataset or appending another publication
