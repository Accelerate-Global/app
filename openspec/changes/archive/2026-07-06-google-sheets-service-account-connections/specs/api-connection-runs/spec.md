## ADDED Requirements

### Requirement: Dataset admins create Google Sheets connections with service-account sharing
The system SHALL allow dataset admins to create private Google Sheets API connections by sharing a Google Sheet with the configured app service account and checking service-account access from the admin API Connections surface.

#### Scenario: Admin views the service-account connection surface
- **WHEN** a dataset admin opens the Google Sheets connection surface
- **THEN** the system shows the app service account email as a copyable value
- **AND** the system shows a Google Sheet URL input, a Check access action, tab selection, classification selection, and a Connect action
- **AND** the system does not show a Google account OAuth, Google sign-in, or public-Sheet publishing path

#### Scenario: Service account environment is not configured
- **WHEN** a dataset admin opens the Google Sheets connection surface or checks access while service-account credentials are missing or invalid
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

### Requirement: Connected Google Sheets actions support service-account management
The system SHALL expose Google Sheets connection actions that let dataset admins refresh, inspect, re-check, and disconnect service-account-backed Sheet connections.

#### Scenario: Admin views connected Google Sheets actions
- **WHEN** a dataset admin views a connected Google Sheets row or detail page
- **THEN** the system offers actions to refresh now, open the target dataset when present, open the Google Sheet, check service-account access, copy the app service account email, and disconnect

#### Scenario: Admin re-checks an existing connection
- **WHEN** a dataset admin checks access for an existing Google Sheets connection
- **THEN** the system verifies the saved spreadsheet and selected tab with the service account
- **AND** the system reports success with the spreadsheet title and tab title or an actionable access/tab-missing failure without changing the target dataset

#### Scenario: Admin disconnects a Google Sheets connection
- **WHEN** a dataset admin disconnects a Google Sheets connection
- **THEN** the system removes the selected API connection from the active connection list
- **AND** the system does not delete existing imported datasets, prior run history, or archived output artifacts

## MODIFIED Requirements

### Requirement: API Connections web dashboard omits saved profile configuration
The system SHALL present the admin API Connections page as an operational dashboard for saved API connection records without exposing generic saved request configuration or generic web profile creation controls.

#### Scenario: Admin views saved connection without configuration fields
- **WHEN** a dataset admin opens the API Connections page and saved connections exist
- **THEN** the page shows selectable saved connections, service-account Google Sheets creation entry points, and operational run controls without showing generic URL, method, headers, body, response parsing, import configuration, preset, save, delete, or profile editing controls

#### Scenario: Admin views empty saved connection list
- **WHEN** a dataset admin opens the API Connections page and no saved connections exist
- **THEN** the page explains that no API connections are available and offers only the service-account Google Sheets connection flow, not generic API profile creation

### Requirement: API connection profile writes are unavailable through web HTTP endpoints
The system SHALL keep generic API connection profile creation, update, and deletion unavailable through the admin web HTTP API while preserving authorized read, run, history, detail, download, and provider-specific Google Sheets service-account connection behavior.

#### Scenario: Admin attempts generic web profile creation
- **WHEN** a dataset admin sends a generic create request to the admin API connection collection endpoint
- **THEN** the system rejects the request without creating a saved generic API connection

#### Scenario: Admin attempts generic web profile update or deletion
- **WHEN** a dataset admin sends a generic update or delete request to an individual admin API connection endpoint
- **THEN** the system rejects the request without changing or deleting the saved API connection

#### Scenario: Admin creates Google Sheets connections through provider endpoint
- **WHEN** a dataset admin completes a valid service-account Google Sheets access check, selects one or more readable tabs, chooses a classification, and confirms the provider-specific connection request
- **THEN** the system creates Google Sheets API connection rows for the selected tabs

### Requirement: Google Sheets tab selection creates refreshable datasets
The system SHALL let dataset admins select one or more tabs from a service-account-readable Google spreadsheet and create one refreshable API connection per selected tab.

#### Scenario: Admin creates tab connections
- **WHEN** a dataset admin selects multiple spreadsheet tabs returned by a service-account access check and confirms the connection request
- **THEN** the system creates one Google Sheets connection for each selected tab
- **AND** each connection stores spreadsheet and tab metadata without storing or exposing user OAuth credentials

#### Scenario: First import creates dataset target
- **WHEN** a Google Sheets connection has no target dataset and an import run succeeds
- **THEN** the system creates one shared dataset from that tab
- **AND** the system updates the connection so future imports replace that same dataset

#### Scenario: Refresh replaces existing dataset
- **WHEN** a Google Sheets connection already has a target dataset and an import run succeeds
- **THEN** the system replaces that dataset through the existing dataset replacement and version-history behavior

#### Scenario: Sheet parse or size failure preserves current dataset
- **WHEN** a Google Sheets run can access the selected tab but has no header row, exceeds dataset size limits, or returns an invalid tab shape
- **THEN** the system records a failed run and does not replace the current target dataset

#### Scenario: Sheet access failure preserves current dataset
- **WHEN** a Google Sheets run cannot access the spreadsheet or selected tab with the service account
- **THEN** the system records a failed run and does not create or replace a dataset

### Requirement: Google Sheets runs use fixed Google APIs and redacted credentials
The system SHALL execute Google Sheets runs through fixed Google API endpoints while keeping service-account credentials server-side and redacted.

#### Scenario: Google Sheets values are normalized
- **WHEN** a Google Sheets connection run succeeds
- **THEN** the system imports the selected tab's full used range, treats the first non-empty row as headers, skips fully empty data rows, normalizes headers using the existing dataset header rules, and archives JSON and CSV outputs

#### Scenario: Service-account credentials are not exposed
- **WHEN** a Google Sheets run completes, fails, or produces archived output
- **THEN** run logs, previews, error messages, saved connection metadata, and output artifacts do not expose service-account private keys, signed assertions, bearer access tokens, or raw provider credential payloads
- **AND** the app service account email may be shown only as the share target for administrators

#### Scenario: Service account is not configured for a run
- **WHEN** a Google Sheets connection run starts while service-account credentials are missing or invalid
- **THEN** the system records a failed run with a redacted configuration error and does not create or replace a dataset

#### Scenario: Service account loses Sheet access
- **WHEN** a Google Sheets connection run starts after the Sheet is unshared, deleted, or otherwise no longer readable by the service account
- **THEN** the system records a failed run with an actionable access error and does not create or replace a dataset

## REMOVED Requirements

### Requirement: Dataset admins create Google Sheets connections with OAuth
**Reason**: Google Sheets connections are moving to an app-owned service-account share model, and Google account OAuth must no longer be exposed as a product path.
**Migration**: Use the service-account Google Sheets connection flow. Existing Google Sheets connection metadata, run history, and target datasets remain, but refreshes require the Sheet to be shared with the app service account as a Viewer.
