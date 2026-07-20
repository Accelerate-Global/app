## MODIFIED Requirements

### Requirement: API Connections index lists available connections
The system SHALL present `/dashboard/api-connections` as an admin-only
Connections surface with a `Dataset sources` card containing a simple table of
available API connection records.

#### Scenario: Admin browses available connections
- **WHEN** a dataset admin opens `/dashboard/api-connections`
- **THEN** the page shows a `Connections` heading and a `Dataset sources` card
  with an `Add connection` action and a table with source, classification, and
  last ingestion columns
- **AND** the Add connection action opens the existing Google Sheets connection
  workflow
- **AND** the Dataset sources card does not show search, classification filter,
  status filter, index status column controls, or inline source onboarding
- **AND** the separate Resources card remains unchanged

#### Scenario: Admin selects a connection
- **WHEN** a dataset admin clicks or keyboard-selects an API connection row
- **THEN** the system navigates to that connection's dedicated dashboard page

### Requirement: API connection detail dashboard supports run operations
The system SHALL provide an admin-only detail page for each API connection that
leads with source identity, target dataset, current status, and supported run
actions, followed by one `Run history` diagnostic card.

#### Scenario: Admin views a connection detail page
- **WHEN** a dataset admin opens `/dashboard/api-connections/{connectionId}` for
  a known materialized or repo-owned connection
- **THEN** the page shows the connection name, source information, current
  status, target dataset when present, test/import actions, and one Run history
  card
- **AND** the page does not show separate Run Detail or Ingestion History cards
- **AND** the page does not show disabled future pipeline-stage controls

#### Scenario: Unknown connection detail page
- **WHEN** a dataset admin opens `/dashboard/api-connections/{connectionId}` for
  an unknown connection
- **THEN** the system returns the normal not-found route behavior

#### Scenario: Non-admin cannot view detail page
- **WHEN** an unauthenticated user or non-admin user opens a connection detail page
- **THEN** the system applies the existing API Connections admin redirect behavior

### Requirement: Ingestion history uses DataGrid
The system SHALL list each initiated run for a connection in the always-visible
`Run history` card using the existing DataGrid table interface and SHALL show
the selected run's diagnostics in a right-side detail sheet.

#### Scenario: Admin views run history
- **WHEN** a dataset admin opens a connection detail page
- **THEN** the Run history DataGrid lists runs with initiated time, mode, status,
  started time, completed time, duration, row count, HTTP status, actor, and
  artifact actions
- **AND** at most five run rows are visible before the history table scrolls

#### Scenario: Admin selects a run row
- **WHEN** a dataset admin selects a row in Run history
- **THEN** that row becomes selected and a right-side Run detail sheet opens
- **AND** the sheet shows that run's status, timing, row count, logs, error,
  preview, output downloads, and imported dataset link when available
- **AND** closing the sheet does not change or delete the selected run or its
  persisted history

#### Scenario: Admin uses an artifact action
- **WHEN** a dataset admin selects a JSON, CSV, or dataset action within a run row
- **THEN** the selected artifact action proceeds without opening the Run detail
  sheet as a side effect
