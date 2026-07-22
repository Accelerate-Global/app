## MODIFIED Requirements

### Requirement: API connection runs preserve downloadable outputs
The system SHALL persist successful run outputs as archived artifacts containing normalized rows for CSV export and redacted raw response data for JSON export, while requiring approved source-specific forming before an IMB import output becomes a workspace dataset.

#### Scenario: Successful test run output
- **WHEN** a saved API connection test run succeeds
- **THEN** the system archives parsed rows, columns, a redacted raw response artifact, and output metadata without creating or replacing a dataset

#### Scenario: Successful non-IMB import run output
- **WHEN** a saved API connection import run other than IMB succeeds
- **THEN** the system archives parsed output artifacts and also creates or replaces the configured dataset using the existing import settings

#### Scenario: Successful IMB import run output
- **WHEN** the repo-owned IMB connection import run succeeds
- **THEN** the system archives parsed source rows and redacted raw output with checksums
- **AND** does not create or replace a workspace dataset until an admin explicitly publishes a valid formed candidate

## ADDED Requirements

### Requirement: ArcGIS feature paging retains one stable object-ID order
The system SHALL apply the discovered ArcGIS object identifier as the ordering field before retaining offset zero and SHALL use the same ordering for every retained page.

#### Scenario: Object identifier must be discovered
- **WHEN** the first ArcGIS query response identifies the object-ID field and the request did not already include an ordering field
- **THEN** the system treats that response as discovery only
- **AND** refetches offset zero ordered by the discovered object-ID field before retaining features

#### Scenario: Ordered ArcGIS pages continue
- **WHEN** an ordered retained page contains the configured page size
- **THEN** the system requests the next offset with the same ordering field
- **AND** archives rows in that deterministic page order

#### Scenario: ArcGIS response omits a usable object identifier
- **WHEN** stable ordering cannot be established for a paged feature response
- **THEN** the run fails with a normalized error instead of archiving potentially duplicated or skipped rows
