## MODIFIED Requirements

### Requirement: API Connections index lists available connections
The system SHALL present `/dashboard/api-connections` as an admin-only
Connections surface with a `Datasets` card containing a simple table of
available API connection records and a separate Resources metadata table.

#### Scenario: Admin browses available connections
- **WHEN** a dataset admin opens `/dashboard/api-connections`
- **THEN** the page shows a `Connections` heading and a `Datasets` card with a
  table containing source, classification, and last ingestion columns
- **AND** the Datasets card does not show an Add connection action, search,
  classification filter, status filter, index status column controls, or inline
  source onboarding
- **AND** the separate Resources card presents Source, Entries, and Last updated columns

#### Scenario: Admin views an empty connection catalog
- **WHEN** a dataset admin opens `/dashboard/api-connections` and no connections exist
- **THEN** the Datasets card reports that no datasets are connected without showing an Add connection action

#### Scenario: Admin selects a connection
- **WHEN** a dataset admin clicks or keyboard-selects an API connection row
- **THEN** the system navigates to that connection's dedicated dashboard page

### Requirement: API connection detail dashboard supports run operations
The system SHALL provide an admin-only detail page for each API connection that
leads with source identity, target dataset, the latest run's user-facing state,
and supported run actions, followed by one `Run history` diagnostic card. The
latest persisted `success` run state SHALL be presented as `Up to date` without
changing the persisted run status.

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

#### Scenario: Unknown connection detail page
- **WHEN** a dataset admin opens `/dashboard/api-connections/{connectionId}` for
  an unknown connection
- **THEN** the system returns the normal not-found route behavior

#### Scenario: Non-admin cannot view detail page
- **WHEN** an unauthenticated user or non-admin user opens a connection detail page
- **THEN** the system applies the existing API Connections admin redirect behavior

### Requirement: Dataset admins create Google Sheets connections with service-account sharing
The system SHALL allow dataset admins to create private Google Sheets API connections through the Add connection workflow by sharing a Google Sheet with the configured app service account and checking service-account access.

#### Scenario: Admin views the service-account connection stage
- **WHEN** a dataset admin opens the Google Sheets connection workflow
- **THEN** the system presents the Google Sheets connection flow with an `Add connection` heading
- **AND** the system shows the app service account email as a copyable value
- **AND** the system shows a Google Sheet URL input and Check access action before tab, header, classification, access, and import review
- **AND** the system does not show an account authorization or public-Sheet publishing path

#### Scenario: Service account environment is not configured
- **WHEN** a dataset admin opens the Google Sheets connection stage or checks access while service-account credentials are missing or invalid
- **THEN** the system shows that Google Sheets service-account access is not configured
- **AND** the system does not create an API connection or dataset

#### Scenario: Admin checks access to a shared Sheet
- **WHEN** a dataset admin pastes a valid Google Sheet URL for a private Sheet shared with the app service account as a Viewer and checks access
- **THEN** the system validates the URL, fetches spreadsheet metadata with the service account, and shows the spreadsheet title and readable tabs

#### Scenario: Admin checks access to an unshared Sheet
- **WHEN** a dataset admin checks access for a Google Sheet that is not readable by the app service account
- **THEN** the system explains that the Sheet must be shared with the app service account as a Viewer
- **AND** the system does not create an API connection or dataset
