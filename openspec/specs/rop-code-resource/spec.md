# rop-code-resource Specification

## Purpose
Define the authenticated HIS Registry of Peoples code reference resource,
including flattened ROP1/ROP2/ROP25/ROP3 lookup behavior, source refresh,
detail geography, validation, download behavior, and UI smoke coverage.
## Requirements
### Requirement: ROP code resource is available in the app
The system SHALL provide an authenticated HIS Registry of Peoples code resource
for ROP1, ROP2, ROP25, and ROP3 values.

#### Scenario: Authenticated user opens ROP code resource
- **WHEN** an authenticated user opens `/dashboard/rop-codes`
- **THEN** the page shows the generated ROP code resource
- **AND** the page provides a back link to `/dashboard/resources`
- **AND** the resource shows source metadata and row counts

#### Scenario: Anonymous user opens ROP code resource
- **WHEN** an anonymous user opens `/dashboard/rop-codes`
- **THEN** the system redirects the user to the sign-in page

### Requirement: ROP code resource flattens the hierarchy into one table
The system SHALL render a single searchable table with one matched field each
for ROP1, ROP2, ROP25, and ROP3.

#### Scenario: User views flattened ROP rows
- **WHEN** a signed-in user views the ROP resource table
- **THEN** each visible row shows one ROP1 field, one ROP2 field, one ROP25
  field, and one ROP3 field
- **AND** each populated field combines the code and name for that ROP term
- **AND** the row set includes ROP3 people and ROP25 parent-only rows with no
  ROP3 child

#### Scenario: Source parent links are imperfect
- **WHEN** a ROP3 row has a missing ROP25 parent or a conflicting direct ROP2
  value
- **THEN** the row remains visible
- **AND** the system uses the registry-chain match when available
- **AND** the row exposes a join issue label for inspection and download

### Requirement: ROP code resource is searchable, downloadable, and inspectable
The system SHALL allow signed-in users to search, download, and inspect the ROP
code resource without changing workspace data.

#### Scenario: User searches the ROP resource
- **WHEN** a signed-in user searches by ROP code, ROP name, source fields,
  place, language, status, geography, or join issue text
- **THEN** matching rows remain visible in the single table

#### Scenario: User downloads visible ROP rows
- **WHEN** a signed-in user downloads the visible resource data
- **THEN** the system provides a CSV containing the current visible rows
- **AND** the CSV contains the four matched ROP term fields plus source,
  status, and join issue metadata

#### Scenario: User opens a ROP detail sheet
- **WHEN** a signed-in user selects a visible ROP row
- **THEN** a right-side detail sheet opens for that row
- **AND** the sheet shows code, name, description, status, source metadata, and
  join issue details
- **AND** ROP3 geography rows are shown in the sheet when available

### Requirement: ROP code resource can refresh from HIS
The system SHALL support admin-only refreshing of the ROP resource from HIS
ArcGIS source data without requiring database writes, and the refresh request
MUST use a same-origin protected mutation method.

#### Scenario: Admin refreshes ROP source data
- **WHEN** a dataset admin requests a live refresh from the web UI
- **THEN** the page sends the refresh as a `POST` request
- **AND** the page shows refresh progress
- **AND** the system fetches the HIS ROP layers
- **AND** the refreshed result replaces the visible resource for the current
  browser session

#### Scenario: Non-admin views resource controls
- **WHEN** a signed-in non-admin views the ROP resource controls
- **THEN** the refresh control is not shown

#### Scenario: Source refresh fails
- **WHEN** HIS source data is unavailable or invalid
- **THEN** the page keeps the last loaded generated resource visible
- **AND** the page shows a refresh error

#### Scenario: Refresh endpoint receives GET
- **WHEN** a request calls the ROP refresh endpoint with `GET`
- **THEN** the system returns `405 Method Not Allowed`
- **AND** the response identifies `POST` as the allowed method

### Requirement: ROP code resource validates source shape
The system SHALL reject refresh results that have malformed rows, duplicate
codes, suspiciously low table counts, or invalid required hierarchy links.

#### Scenario: HIS result is valid
- **WHEN** all required HIS layers return valid rows
- **THEN** the refresh succeeds and produces sorted flattened entries

#### Scenario: HIS result is invalid
- **WHEN** a required layer returns malformed rows, duplicate codes, or too few
  records
- **THEN** the refresh fails without replacing the current resource

### Requirement: ROP code resource has UI smoke coverage
The system SHALL register the ROP code page in the UI smoke route registry and
expose required smoke markers.

#### Scenario: UI smoke route sweep visits the resource
- **WHEN** UI smoke route coverage is checked
- **THEN** the ROP code page has route-registry entries for signed-in roles
- **AND** the page exposes a matching `data-smoke-page` marker

#### Scenario: UI smoke opens the ROP detail sheet
- **WHEN** UI smoke exercises the ROP detail sheet trigger
- **THEN** the detail sheet exposes matching `data-smoke-surface` and
  `data-smoke-ready` markers
