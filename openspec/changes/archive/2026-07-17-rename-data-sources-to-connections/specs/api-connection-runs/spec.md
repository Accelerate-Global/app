## MODIFIED Requirements

### Requirement: API Connections web dashboard omits saved profile configuration
The system SHALL present the admin API Connections page as a Connections operational dashboard for saved API connection records without exposing generic saved request configuration, generic web profile creation controls, the Google Sheets onboarding form, or reference resources.

#### Scenario: Admin views saved connection without configuration fields
- **WHEN** a dataset admin opens the Connections page and saved connections exist
- **THEN** the page shows selectable saved connections and an Add connection link without showing generic URL, method, headers, body, response parsing, import configuration, preset, save, delete, profile editing, inline Google Sheets creation controls, or reference resources

#### Scenario: Admin views empty saved connection list
- **WHEN** a dataset admin opens the Connections page and no saved connections exist
- **THEN** the page explains that no connections exist and offers the Add connection workflow, not generic API profile creation or reference resources

### Requirement: API Connections index lists available connections
The system SHALL present `/dashboard/api-connections` as an admin-only Connections surface with a simple table of available API connection records.

#### Scenario: Admin browses available connections
- **WHEN** a dataset admin opens `/dashboard/api-connections`
- **THEN** the page shows a `Connections` heading, an `Add connection` action, and a table with source, classification, and last ingestion columns
- **AND** the Add connection action opens the existing Google Sheets connection workflow
- **AND** the page does not show search, classification filter, status filter, index status column controls, inline source onboarding, or a resources card

#### Scenario: Admin selects a connection
- **WHEN** a dataset admin clicks or keyboard-selects an API connection row
- **THEN** the system navigates to that connection's dedicated dashboard page

### Requirement: Dataset admins create Google Sheets connections with service-account sharing
The system SHALL allow dataset admins to create private Google Sheets API connections through the Add connection workflow by sharing a Google Sheet with the configured app service account and checking service-account access.

#### Scenario: Admin views the service-account connection stage
- **WHEN** a dataset admin chooses Add connection from the Connections page
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

### Requirement: API connection resources omit category metadata
The system SHALL persist API connection run resources without category metadata while preserving URL, display text, and source provenance metadata.

#### Scenario: Successful run publishes resources
- **WHEN** a saved API connection run output contains indexed resource URL fields
- **THEN** the system persists each valid deduplicated resource URL
- **AND** the persisted resource includes display text when present
- **AND** the persisted resource includes source row and source resource indexes
- **AND** the persisted resource does not include category metadata

## REMOVED Requirements

### Requirement: API Connections index shows captured resources
**Reason**: The Connections index is now focused exclusively on creating, listing, and opening connection records; the secondary Resources component is intentionally removed.

**Migration**: No data migration is required. Captured-resource persistence and existing resource routes remain intact, but resources are no longer rendered on `/dashboard/api-connections`.
