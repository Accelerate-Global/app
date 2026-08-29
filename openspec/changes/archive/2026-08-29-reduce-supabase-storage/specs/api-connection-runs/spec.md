## MODIFIED Requirements

### Requirement: API connection runs preserve downloadable outputs
The system SHALL preserve successful run outputs as artifacts containing normalized rows for CSV export and redacted raw response data for JSON export, while requiring approved source-specific forming before an IMB import output becomes a workspace dataset. When a source-specific adapter produces normalized rows, the rows artifact SHALL identify the adapter version and checksum while the raw artifact preserves the upstream response used by that adapter. Eligible historical artifacts outside the explicitly configured hot age and version floors MAY transition from hot Supabase Storage to a verified cold Samson archive, but their catalog metadata, checksums, exact rehydration identity, and complete archived payload MUST remain available.

#### Scenario: Successful test run output
- **WHEN** a saved API connection test run succeeds
- **THEN** the system archives parsed rows, columns, a redacted raw response artifact, and output metadata without creating or replacing a dataset

#### Scenario: Successful non-IMB import run output
- **WHEN** a saved API connection import run other than IMB succeeds
- **THEN** the system archives parsed output artifacts and also creates or replaces the configured dataset using the existing import settings

#### Scenario: Successful IMB import run output
- **WHEN** the repo-owned IMB connection import run succeeds
- **THEN** the system archives adapter-normalized source rows with adapter metadata and a redacted raw upstream feature artifact with checksums
- **AND** does not create or replace a workspace dataset until an admin explicitly publishes a valid formed candidate

#### Scenario: Eligible historical run becomes cold
- **WHEN** an old run output is outside the configured hot age and version floors and passes archive, dependency, package-restore, inventory, and operator-approval checks
- **THEN** its payload may leave Supabase Storage through the Storage API
- **AND** the run retains safe catalog metadata, checksums, a complete deduplicated Samson copy, and an operator rehydration identity

#### Scenario: Current or referenced run remains hot
- **WHEN** a run is inside either configured hot floor or is referenced by an active dataset, candidate, publication, release, resource, registry revision, shared object, or downstream lineage edge
- **THEN** its Supabase payload remains hot regardless of capacity pressure
