## ADDED Requirements

### Requirement: ROP lifecycle surfaces have UI smoke coverage
The system SHALL register every new ROP candidate, validation, version history,
activation, rejection, and rollback sheet or dialog for UI smoke.

#### Scenario: UI smoke opens ROP lifecycle controls
- **WHEN** UI smoke exercises an admin ROP lifecycle control
- **THEN** its trigger, surface, and ready markers match the registered smoke
  fixture or targeted route interaction

## MODIFIED Requirements

### Requirement: ROP code resource is available in the app
The system SHALL provide the active persisted HIS Registry of Peoples resource
for ROP1, ROP2, ROP25, ROP3, and associated geography values.

#### Scenario: Authenticated user opens ROP code resource
- **WHEN** an authenticated user opens `/dashboard/rop-codes`
- **THEN** the page shows the active persisted ROP version
- **AND** the page provides a back link to `/dashboard/resources`
- **AND** the resource shows its active version number, source metadata, row
  counts, retrieval time, and deterministic checksum

#### Scenario: Active ROP version is unavailable
- **WHEN** the catalog is initialized but has no healthy active ROP version
- **THEN** the page reports an operational resource error
- **AND** the system does not silently substitute the checked-in generated file

#### Scenario: Anonymous user opens ROP code resource
- **WHEN** an anonymous user opens `/dashboard/rop-codes`
- **THEN** the system redirects the user to the sign-in page

### Requirement: ROP code resource is searchable, downloadable, and inspectable
The system SHALL allow signed-in users to search, download, page through, and
inspect the complete active ROP version without changing workspace data.

#### Scenario: User searches the ROP resource
- **WHEN** a signed-in user searches by ROP code, ROP name, source fields,
  place, language, status, geography, or join issue text
- **THEN** matching rows from the complete active version remain visible in a
  deterministic cursor-paged result

#### Scenario: User downloads matching ROP rows
- **WHEN** a signed-in user downloads the current ROP query
- **THEN** the system streams a CSV containing every matching row from the
  active version, including rows not loaded in the current browser page
- **AND** the CSV contains the four matched ROP term fields plus source, status,
  geography, and join issue metadata

#### Scenario: User opens a ROP detail sheet
- **WHEN** a signed-in user selects a visible ROP row
- **THEN** a right-side detail sheet opens for that row
- **AND** the sheet shows code, name, description, status, source metadata, and
  join issue details
- **AND** ROP3 geography rows from the same active version are shown when
  available

### Requirement: ROP code resource can refresh from HIS
The system SHALL support admin-only creation of a persistent ROP candidate from
HIS ArcGIS source data, and lifecycle mutations MUST use same-origin protected
methods.

#### Scenario: Admin refreshes ROP source data
- **WHEN** a dataset admin requests a live refresh from the web UI
- **THEN** the page sends the refresh as a `POST` request
- **AND** the page shows persisted build progress
- **AND** the system fetches and normalizes the HIS ROP layers
- **AND** a successful build produces candidate metadata, validation results,
  and an active-version diff rather than replacing the visible resource

#### Scenario: Admin activates a valid ROP candidate
- **WHEN** a dataset admin reviews a valid ROP candidate and confirms activation
  with a reason
- **THEN** the candidate becomes the active persisted ROP version
- **AND** later page loads, searches, details, and downloads use that version

#### Scenario: Non-admin views resource controls
- **WHEN** a signed-in non-admin views the ROP resource controls
- **THEN** refresh, candidate, history, activation, rejection, and rollback
  controls are not shown

#### Scenario: Source refresh fails
- **WHEN** HIS source data is unavailable or invalid
- **THEN** the page keeps the active persisted ROP version visible
- **AND** the admin can inspect the normalized failure or validation findings
- **AND** no invalid candidate can be activated

#### Scenario: Refresh endpoint receives GET
- **WHEN** a request calls the ROP refresh endpoint with `GET`
- **THEN** the system returns `405 Method Not Allowed`
- **AND** the response identifies `POST` as the allowed method

### Requirement: ROP code resource validates source shape
The system SHALL mark a ROP candidate invalid when it has malformed rows,
duplicate codes, suspiciously low table counts, invalid required hierarchy
links, or inconsistent package artifacts, projections, counts, or checksum.

#### Scenario: HIS candidate is valid
- **WHEN** all required HIS layers return valid rows and package integrity checks
  pass
- **THEN** the system produces sorted typed ROP term, people, and geography
  projections
- **AND** the candidate becomes eligible for explicit activation

#### Scenario: HIS candidate is invalid
- **WHEN** a required layer returns malformed rows, duplicate codes, too few
  records, invalid hierarchy data, or inconsistent package content
- **THEN** the system persists structured validation findings
- **AND** the candidate cannot replace the active version

#### Scenario: ROP version is bootstrapped
- **WHEN** the existing generated ROP resource is imported into typed
  projections and private artifacts
- **THEN** validation proves exact entry, term, geography, join-issue count, and
  canonical checksum parity before activation
