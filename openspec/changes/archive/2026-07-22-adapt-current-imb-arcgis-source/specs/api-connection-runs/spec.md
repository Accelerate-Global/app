## MODIFIED Requirements

### Requirement: API connection runs preserve downloadable outputs
The system SHALL persist successful run outputs as archived artifacts containing normalized rows for CSV export and redacted raw response data for JSON export, while requiring approved source-specific forming before an IMB import output becomes a workspace dataset. When a source-specific adapter produces normalized rows, the rows artifact SHALL identify the adapter version and checksum while the raw artifact preserves the upstream response used by that adapter.

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

### Requirement: ArcGIS feature rows use IMB-compatible flattening
The system SHALL normalize generic ArcGIS feature rows by preserving all feature attribute keys as columns and flattening geometry keys into `geometry_*` columns in first-seen order. For the repo-owned IMB connection, the system SHALL instead apply the approved replacement-source adapter to normalized rows while preserving the unadapted feature list in the raw artifact.

#### Scenario: Generic feature attributes and geometry are flattened
- **WHEN** a non-IMB ArcGIS FeatureServer response contains features with `attributes` and `geometry`
- **THEN** the normalized rows include every attribute key, include geometry values under `geometry_*` column names, and preserve scalar values as strings for dataset import and CSV download

#### Scenario: Current IMB feature attributes are adapted
- **WHEN** the repo-owned IMB connection receives the approved replacement production schema
- **THEN** normalized rows use the versioned legacy IMB source-column contract consumed by forming
- **AND** the run logs and rows artifact identify the adapter version and checksum

#### Scenario: Required IMB replacement field is absent
- **WHEN** the repo-owned IMB connection response omits an upstream attribute required for identity or the forming contract
- **THEN** the run fails with a normalized schema error and does not archive successful normalized output

#### Scenario: Raw ArcGIS output remains inspectable
- **WHEN** an ArcGIS features run succeeds
- **THEN** the archived JSON output includes the raw feature list used for normalization without exposing secret header values

## ADDED Requirements

### Requirement: Code-managed connection execution uses the deployed definition
The system SHALL execute each repo-owned code-managed connection with the request fields in the deployed definition even when a previously materialized database record contains older request fields, while preserving mutable persisted linkage such as the target dataset.

#### Scenario: Materialized IMB URL is stale
- **WHEN** an admin starts the repo-owned IMB connection after the deployed definition replaces its upstream URL
- **THEN** the run calls the deployed URL rather than the stale materialized URL
- **AND** any existing target dataset association remains unchanged
