## ADDED Requirements

### Requirement: Connection tests and ingestions expose live activity
The system SHALL present queued and running API connection tests and source ingestions as continuously active in the connection detail experience for every provider using the shared run lifecycle.

#### Scenario: Connection test is queued
- **WHEN** an administrator starts a connection test and the returned run is queued
- **THEN** the source status area immediately shows an indeterminate waiting-to-test state, elapsed time, and automatic-refresh feedback

#### Scenario: Connection test is running
- **WHEN** polling observes that a connection test is running
- **THEN** the source status area shows an indeterminate testing-source state and retains the run in history

#### Scenario: Dataset ingestion is queued
- **WHEN** an administrator starts ingestion from a connection and the returned import run is queued
- **THEN** the source status area immediately shows an indeterminate waiting-to-ingest state, elapsed time, and automatic-refresh feedback

#### Scenario: Dataset ingestion is running
- **WHEN** polling observes that a connection import is running
- **THEN** the source status area shows an indeterminate ingesting-source-data state
- **AND** does not imply that staged source data has already been published as a curated dataset

#### Scenario: Active run is restored after navigation
- **WHEN** an administrator opens or reloads a connection detail page whose latest run is queued or running
- **THEN** the page restores live activity from the persisted run timestamps and resumes automatic status refresh

#### Scenario: Connection run reaches a terminal state
- **WHEN** polling observes success or failure for an active test or ingestion
- **THEN** the live activity is replaced by the existing terminal result, duration, run-history detail, and dataset navigation when applicable

#### Scenario: One provider uses the shared lifecycle
- **WHEN** the active run belongs to Etnopedia, ArcGIS/IMB, a generic HTTP API, or Google Sheets
- **THEN** the same progress truthfulness, accessibility, freshness, and terminal-transition rules apply
