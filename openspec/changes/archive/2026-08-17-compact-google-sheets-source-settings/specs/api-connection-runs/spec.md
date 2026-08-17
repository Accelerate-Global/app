## MODIFIED Requirements

### Requirement: API connection detail dashboard supports run operations
The system SHALL provide an admin-only detail page for each API connection that
leads with source identity, target dataset, the latest run's user-facing state,
and supported run actions, followed by one `Run history` diagnostic card. The
latest persisted `success` run state SHALL be presented as `Up to date` without
changing the persisted run status. For Google Sheets connections, the system
SHALL keep provider-specific source configuration and maintenance controls in a
right-side sheet opened from a clearly labeled page-level button so that the
always-visible content begins with source status and then run history.

#### Scenario: Admin views a connection detail page
- **WHEN** a dataset admin opens `/dashboard/api-connections/{connectionId}` for
  a known materialized or repo-owned connection
- **THEN** the page shows the connection name, source information, latest run
  state, target dataset when present, test/import actions, and one Run history
  card
- **AND** a latest successful run is labeled `Up to date`
- **AND** queued, running, failed, and idle states retain their distinct labels
- **AND** the page does not show separate Run Detail or Ingestion History cards
- **AND** the page does not show disabled future pipeline-stage controls

#### Scenario: Admin opens Google Sheets source settings
- **WHEN** a dataset admin opens a Google Sheets connection detail page
- **THEN** the always-visible content begins with Source status followed by Run history
- **AND** the page shows a `Google Sheets source` button instead of an always-visible Google Sheets source card
- **WHEN** the admin activates the `Google Sheets source` button
- **THEN** a right-side sheet shows the spreadsheet and tab identity, service-account details, data-workflow assignment, header review, access check, Google Sheet and dataset links when available, and disconnect controls
- **AND** closing the sheet preserves the connection and its persisted configuration

#### Scenario: Unknown connection detail page
- **WHEN** a dataset admin opens `/dashboard/api-connections/{connectionId}` for
  an unknown connection
- **THEN** the system returns the normal not-found route behavior

#### Scenario: Non-admin cannot view detail page
- **WHEN** an unauthenticated user or non-admin user opens a connection detail page
- **THEN** the system applies the existing API Connections admin redirect behavior
