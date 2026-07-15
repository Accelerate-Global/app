## MODIFIED Requirements

### Requirement: Connected Google Sheets actions support service-account management
The system SHALL expose active Google Sheets connection actions that let dataset
admins refresh, inspect, re-check, and disconnect service-account-backed Sheet
connections while preserving an authorized audit history for disconnected
connections.

#### Scenario: Admin views connected Google Sheets actions
- **WHEN** a dataset admin views an active connected Google Sheets row or detail page
- **THEN** the system offers actions to refresh now, open the target dataset when present, open the Google Sheet, check service-account access, copy the app service account email, and disconnect

#### Scenario: Admin re-checks an existing connection
- **WHEN** a dataset admin checks access for an existing active Google Sheets connection
- **THEN** the system verifies the saved spreadsheet and selected tab with the service account
- **AND** the system reports success with the current spreadsheet title and tab title or an actionable access/tab-missing failure without changing the target dataset

#### Scenario: Admin disconnects a Google Sheets connection
- **WHEN** a dataset admin disconnects an active Google Sheets connection
- **THEN** the system archives the selected connection and removes it from the active connection list
- **AND** the system does not delete the connection record, existing imported dataset, prior run history, logs, resources, archived output metadata, or private output artifacts

#### Scenario: Admin inspects disconnected connection history
- **WHEN** a dataset admin opens authorized history for an archived Google Sheets connection
- **THEN** the system makes its prior runs and private archived outputs inspectable and downloadable under existing authorization
- **AND** the system does not offer new refresh or import actions for that archived connection

#### Scenario: Queued run is disconnected before execution
- **WHEN** a Google Sheets run is queued and its connection is archived before execution begins
- **THEN** the system records the run as failed with a clear disconnect message
- **AND** the run does not fetch the Sheet, write output artifacts, create a dataset, or replace a target dataset

## ADDED Requirements

### Requirement: Active Google Sheets source connections are unique
The system SHALL identify a Google Sheets source by its provider, spreadsheet
ID, and stable Google `sheetId`. At most one active connection for that source
MUST exist, regardless of URL or display title. The system SHALL enforce this
in persistent storage and SHALL also return a friendly conflict before creating
connections when possible.

#### Scenario: Admin selects an already active tab
- **WHEN** a dataset admin selects a Google Sheets tab that already has an active connection
- **THEN** the system identifies the existing active connection as a conflict
- **AND** it creates no duplicate connection for that tab

#### Scenario: Multi-tab creation includes an active duplicate
- **WHEN** a dataset admin submits multiple selected tabs and any selected tab already has an active connection
- **THEN** the system rejects the connection request atomically with the conflicting tab information
- **AND** it creates no new connection for the submitted selection

#### Scenario: Concurrent active-source creation is attempted
- **WHEN** concurrent requests attempt to create active connections for the same spreadsheet and stable tab ID
- **THEN** the system persists at most one active connection
- **AND** the losing request receives an actionable conflict without deleting or altering the winning connection

#### Scenario: Admin reconnects an archived source
- **WHEN** a dataset admin selects a Sheet tab whose most recent matching connection is archived
- **THEN** the system reactivates that matching connection with its preserved target dataset linkage and history
- **AND** the system maintains exactly one active connection for the source

### Requirement: Google Sheets connections resolve tab renames by stable identity
The system SHALL resolve a Google Sheets connection's selected tab from fresh
spreadsheet metadata using the stored stable `sheetId` before re-checking access
or fetching values. The system SHALL use the currently resolved tab title for
the Google values request and synchronize safe display metadata when a title
changes.

#### Scenario: Selected Sheet tab is renamed
- **WHEN** the selected Google Sheets tab is renamed after its connection is created
- **AND** the stable `sheetId` remains present and readable
- **THEN** an access check or refresh resolves the renamed tab by stable ID
- **AND** the system updates the connection's display metadata to the current title and refreshes the same target dataset

#### Scenario: Selected stable tab no longer exists
- **WHEN** a Google Sheets access check or refresh cannot find the stored stable `sheetId` in readable spreadsheet metadata
- **THEN** the system reports an actionable tab-missing failure using redacted provider details
- **AND** it does not create or replace a target dataset
