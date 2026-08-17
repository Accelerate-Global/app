## ADDED Requirements

### Requirement: Dataset ingestion remains observably active
The system SHALL show continuous, per-dataset progress while Google Sheets or CSV data is being ingested and SHALL preserve independent outcomes when multiple datasets are created together.

#### Scenario: Google Sheets first import is active
- **WHEN** a newly connected Sheet tab has a queued or running first import
- **THEN** its onboarding result card shows an indeterminate ingestion phase, elapsed time, and automatic-refresh freshness
- **AND** does not derive a percentage from queued or running status

#### Scenario: Multiple Sheet tabs import independently
- **WHEN** multiple selected Sheet tabs have imports in different lifecycle states
- **THEN** each result card shows its own active, successful, or failed state
- **AND** one tab's failure does not stop visible activity or available actions for another tab

#### Scenario: Administrator retries a failed Sheet import
- **WHEN** an administrator retries one failed onboarding import
- **THEN** that item starts a new active interval and returns to queued or running feedback without reconnecting successful sources

#### Scenario: CSV dataset is being created
- **WHEN** a confirmed CSV is uploading, parsing, or persisting rows
- **THEN** onboarding shows its measured progress, current stage, and available row count until success or failure

#### Scenario: Existing dataset is being replaced from CSV
- **WHEN** an administrator confirms a CSV replacement through the existing upload workflow
- **THEN** the replacement shows measured upload and row-persistence progress until the replacement succeeds or fails

#### Scenario: Dataset ingestion completes
- **WHEN** a Sheet or CSV ingestion reaches success or failure
- **THEN** active progress stops and the item shows its existing Open dataset, retry, or redacted failure outcome as applicable
