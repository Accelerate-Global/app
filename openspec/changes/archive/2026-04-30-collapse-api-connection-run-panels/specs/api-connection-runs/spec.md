## MODIFIED Requirements

### Requirement: API connection detail dashboard supports run operations
The system SHALL provide an admin-only detail page for each API connection that supports existing test and import run operations.

#### Scenario: Admin views a connection detail page
- **WHEN** a dataset admin opens `/dashboard/api-connections/{connectionId}` for a known materialized or repo-owned connection
- **THEN** the page shows the connection name, description, current status, pipeline skeleton, run actions, collapsed Run Detail section, and collapsed Ingestion History section
- **AND** Run Detail appears before Ingestion History

#### Scenario: Unknown connection detail page
- **WHEN** a dataset admin opens `/dashboard/api-connections/{connectionId}` for an unknown connection
- **THEN** the system returns the normal not-found route behavior

#### Scenario: Non-admin cannot view detail page
- **WHEN** an unauthenticated user or non-admin user opens a connection detail page
- **THEN** the system applies the existing API Connections admin redirect behavior

### Requirement: Ingestion history uses DataGrid
The system SHALL list each initiated run for a connection as an ingestion row using the existing DataGrid table interface.

#### Scenario: Admin views ingestion history
- **WHEN** a dataset admin expands Ingestion History on a connection detail page
- **THEN** the DataGrid lists runs with initiated time, mode, status, started time, completed time, duration, row count, HTTP status, actor, and artifact actions
- **AND** at most five run rows are visible before the history table scrolls

#### Scenario: Admin selects an ingestion row
- **WHEN** a dataset admin selects an ingestion row
- **THEN** that run becomes the selected run for Run Detail
- **AND** the page does not automatically expand the Run Detail section
- **AND** when the admin expands Run Detail, the page shows that run's logs, error, preview, output downloads, and imported dataset link when available
