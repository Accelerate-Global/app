## MODIFIED Requirements

### Requirement: API Connections web dashboard omits saved profile configuration
The system SHALL present the admin API Connections page as a Data sources operational dashboard for saved API connection records without exposing generic saved request configuration, generic web profile creation controls, or the Google Sheets onboarding form.

#### Scenario: Admin views saved connection without configuration fields
- **WHEN** a dataset admin opens the Data sources page and saved connections exist
- **THEN** the page shows selectable saved connections and an Add dataset link without showing generic URL, method, headers, body, response parsing, import configuration, preset, save, delete, profile editing, or inline Google Sheets creation controls

#### Scenario: Admin views empty saved connection list
- **WHEN** a dataset admin opens the Data sources page and no saved connections exist
- **THEN** the page explains that no data sources are connected and offers the Add dataset workflow, not generic API profile creation

### Requirement: API Connections index lists available connections
The system SHALL present `/dashboard/api-connections` as an admin-only Data sources surface with a simple table of available API connection records.

#### Scenario: Admin browses available connections
- **WHEN** a dataset admin opens `/dashboard/api-connections`
- **THEN** the page shows a `Data sources` heading, an Add dataset action, and a table with source, classification, and last ingestion columns
- **AND** the page does not show search, classification filter, status filter, index status column controls, or inline source onboarding

#### Scenario: Admin selects a connection
- **WHEN** a dataset admin clicks or keyboard-selects an API connection row
- **THEN** the system navigates to that connection's dedicated dashboard page

### Requirement: API connection detail dashboard supports run operations
The system SHALL provide an admin-only detail page for each API connection that leads with source identity, target dataset, current status, and supported run actions while keeping run detail and ingestion history available as secondary diagnostics.

#### Scenario: Admin views a connection detail page
- **WHEN** a dataset admin opens `/dashboard/api-connections/{connectionId}` for a known materialized or repo-owned connection
- **THEN** the page shows the connection name, source information, current status, target dataset when present, test/import actions, and collapsed diagnostic detail/history
- **AND** the page does not show disabled future pipeline-stage controls

#### Scenario: Unknown connection detail page
- **WHEN** a dataset admin opens `/dashboard/api-connections/{connectionId}` for an unknown connection
- **THEN** the system returns the normal not-found route behavior

#### Scenario: Non-admin cannot view detail page
- **WHEN** an unauthenticated user or non-admin user opens a connection detail page
- **THEN** the system applies the existing API Connections admin redirect behavior

### Requirement: Dataset admins create Google Sheets connections with service-account sharing
The system SHALL allow dataset admins to create private Google Sheets API connections through the Add dataset workflow by sharing a Google Sheet with the configured app service account and checking service-account access.

#### Scenario: Admin views the service-account connection stage
- **WHEN** a dataset admin chooses Google Sheet in the Add dataset workflow
- **THEN** the system shows the app service account email as a copyable value
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

#### Scenario: Admin enters an invalid Google Sheet URL
- **WHEN** a dataset admin checks access with a URL that does not identify a Google spreadsheet
- **THEN** the system shows an invalid Google Sheet URL error
- **AND** the system does not contact arbitrary user-provided hosts
- **AND** the system does not create an API connection or dataset

#### Scenario: Checked Sheet has no readable tabs
- **WHEN** service-account metadata access succeeds but the spreadsheet has no readable tabs
- **THEN** the system shows that no readable tabs were found
- **AND** the system does not create an API connection or dataset

#### Scenario: Non-admin cannot create Google Sheets service-account connections
- **WHEN** an unauthenticated user or non-admin user attempts to view service-account configuration, check Sheet access, create tab connections, or disconnect a Google Sheets connection
- **THEN** the system rejects the request using the existing API Connections admin authorization behavior
- **AND** the system does not expose service-account configuration beyond the public app email
- **AND** the system does not create, modify, or delete API connections

## ADDED Requirements

### Requirement: Google Sheets connections accept reviewed dataset names
The system SHALL accept one reviewed dataset name per selected Sheet tab while preserving backward compatibility for callers that omit reviewed names.

#### Scenario: Onboarding submits reviewed names
- **WHEN** an authorized connect request supplies one valid unique dataset name for every selected stable `sheetId`
- **THEN** each created connection and its first imported dataset use the reviewed name
- **AND** provider metadata retains the source spreadsheet and tab titles independently

#### Scenario: Legacy caller omits reviewed names
- **WHEN** an authorized valid connect request omits reviewed dataset settings
- **THEN** the system derives names from the spreadsheet and tab titles using the existing behavior

#### Scenario: Reviewed names are incomplete or duplicated
- **WHEN** reviewed settings omit a selected tab, include an unselected tab, or contain case-insensitive duplicate names
- **THEN** the system rejects the request without creating any connections

## REMOVED Requirements

### Requirement: Pipeline stages are visual skeleton only
**Reason**: Disabled Configure, Fetch, Normalize, Archive Output, and Import Dataset cards make operational detail appear incomplete and compete with the real run actions.

**Migration**: Existing Run test and import actions remain available in the primary source status/action area; run detail and ingestion history remain available as collapsed diagnostics.
