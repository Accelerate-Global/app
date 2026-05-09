## ADDED Requirements

### Requirement: Dataset admins create Google Sheets connections with OAuth
The system SHALL allow dataset admins to create private Google Sheets API connections from the admin API Connections surface using a Google OAuth authorization flow.

#### Scenario: Admin starts Google Sheets connection flow
- **WHEN** a dataset admin enters a Google Sheet URL and starts the connection flow
- **THEN** the system validates that the URL identifies a Google spreadsheet
- **AND** the system redirects the admin to Google OAuth with read-only Sheets access, offline access, and a CSRF-protected state value

#### Scenario: OAuth callback completes connection draft
- **WHEN** Google redirects back with a valid authorization code and state for the same signed-in dataset admin
- **THEN** the system exchanges the code server-side, stores the refresh token in Supabase Vault, fetches spreadsheet metadata, and records a short-lived connection draft with available sheet tabs

#### Scenario: Non-admin cannot create Google Sheets connection
- **WHEN** an unauthenticated user or non-admin user attempts to start or complete a Google Sheets connection flow
- **THEN** the system rejects the request and does not store OAuth credentials or create a connection

#### Scenario: OAuth failure does not create connection
- **WHEN** OAuth is denied, state validation fails, token exchange fails, or spreadsheet metadata cannot be loaded
- **THEN** the system shows a connection error and does not create an API connection or dataset

### Requirement: Google Sheets tab selection creates refreshable datasets
The system SHALL let dataset admins select one or more tabs from an authorized Google spreadsheet and create one refreshable API connection per selected tab.

#### Scenario: Admin creates tab connections
- **WHEN** a dataset admin selects multiple spreadsheet tabs and confirms the draft
- **THEN** the system creates one Google Sheets connection for each selected tab
- **AND** each connection stores spreadsheet and tab metadata without exposing OAuth tokens

#### Scenario: First import creates dataset target
- **WHEN** a Google Sheets connection has no target dataset and an import run succeeds
- **THEN** the system creates one shared dataset from that tab
- **AND** the system updates the connection so future imports replace that same dataset

#### Scenario: Refresh replaces existing dataset
- **WHEN** a Google Sheets connection already has a target dataset and an import run succeeds
- **THEN** the system replaces that dataset through the existing dataset replacement and version-history behavior

#### Scenario: Sheet parse failure preserves current dataset
- **WHEN** a Google Sheets run cannot fetch values, has no header row, exceeds dataset size limits, or returns an invalid tab shape
- **THEN** the system records a failed run and does not replace the current target dataset

### Requirement: Google Sheets runs use fixed Google APIs and redacted credentials
The system SHALL execute Google Sheets runs through fixed Google API endpoints while keeping OAuth credentials server-side and redacted.

#### Scenario: Google Sheets values are normalized
- **WHEN** a Google Sheets connection run succeeds
- **THEN** the system imports the selected tab's full used range, treats the first non-empty row as headers, skips fully empty data rows, normalizes headers using the existing dataset header rules, and archives JSON and CSV outputs

#### Scenario: Credentials are not exposed
- **WHEN** a Google Sheets run completes, fails, or produces archived output
- **THEN** run logs, previews, error messages, saved connection metadata, and output artifacts do not expose access tokens, refresh tokens, client secrets, or OAuth authorization codes

#### Scenario: Google credential is revoked or expired
- **WHEN** a stored Google credential can no longer refresh an access token
- **THEN** the system records a failed run and does not create or replace a dataset

## MODIFIED Requirements

### Requirement: API Connections web dashboard omits saved profile configuration
The system SHALL present the admin API Connections page as an operational dashboard for saved API connection records without exposing generic saved request configuration or generic web profile creation controls.

#### Scenario: Admin views saved connection without configuration fields
- **WHEN** a dataset admin opens the API Connections page and saved connections exist
- **THEN** the page shows selectable saved connections, Google Sheets creation entry points, and operational run controls without showing generic URL, method, headers, body, response parsing, import configuration, preset, save, delete, or profile editing controls

#### Scenario: Admin views empty saved connection list
- **WHEN** a dataset admin opens the API Connections page and no saved connections exist
- **THEN** the page explains that no API connections are available and offers only the Google Sheets connection flow, not generic API profile creation

### Requirement: API connection profile writes are unavailable through web HTTP endpoints
The system SHALL keep generic API connection profile creation, update, and deletion unavailable through the admin web HTTP API while preserving authorized read, run, history, detail, download, and provider-specific Google Sheets connection behavior.

#### Scenario: Admin attempts generic web profile creation
- **WHEN** a dataset admin sends a generic create request to the admin API connection collection endpoint
- **THEN** the system rejects the request without creating a saved generic API connection

#### Scenario: Admin attempts generic web profile update or deletion
- **WHEN** a dataset admin sends a generic update or delete request to an individual admin API connection endpoint
- **THEN** the system rejects the request without changing or deleting the saved API connection

#### Scenario: Admin creates Google Sheets connections through provider endpoint
- **WHEN** a dataset admin completes a valid Google Sheets connection draft through the Google Sheets provider endpoint
- **THEN** the system creates Google Sheets API connection rows for the selected tabs
