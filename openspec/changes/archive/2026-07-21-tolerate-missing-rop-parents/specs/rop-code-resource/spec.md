## MODIFIED Requirements

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
- **WHEN** a dataset admin reviews a valid ROP candidate, including any warning
  findings, and confirms activation with a reason
- **THEN** the candidate becomes the active persisted ROP version
- **AND** later page loads, searches, details, and downloads use that version

#### Scenario: Non-admin views resource controls
- **WHEN** a signed-in non-admin views the ROP resource controls
- **THEN** refresh, candidate, history, activation, rejection, and rollback
  controls are not shown

#### Scenario: Source refresh fails
- **WHEN** HIS source data is unavailable or invalid beyond the documented
  tolerance limits
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
links beyond documented tolerance limits, or inconsistent package artifacts,
projections, counts, or checksum.

#### Scenario: HIS candidate is valid
- **WHEN** all required HIS layers return valid rows above their completeness
  safety floors, any missing ROP2 parents remain within the bounded tolerance,
  and package integrity checks pass
- **THEN** the system produces sorted typed ROP term, people, and geography
  projections
- **AND** the candidate becomes eligible for explicit activation

#### Scenario: HIS ROP25 count changes within the safety buffer
- **WHEN** the complete HIS ROP25 layer contains 8,991 valid unique rows
- **THEN** the source-count safeguard accepts the layer for candidate building
- **AND** the remaining hierarchy and package validations still run

#### Scenario: Bounded ROP2 parent reference is missing
- **WHEN** no more than 10 distinct ROP25 records and no more than 0.1% of the
  ROP25 layer reference ROP2 codes absent from the ROP2 layer
- **THEN** affected rows retain the referenced ROP2 code as `Not listed`, their
  ROP25, ROP3, and geography data, and no invented ROP1 value
- **AND** each visible affected row produces a structured warning finding
- **AND** the warning-only candidate remains eligible for explicit activation

#### Scenario: Missing ROP2 parents exceed tolerance
- **WHEN** more than 10 distinct ROP25 records or more than 0.1% of the ROP25
  layer reference absent ROP2 codes
- **THEN** the source build fails hierarchy validation
- **AND** no invalid candidate can replace the active version

#### Scenario: HIS candidate is invalid
- **WHEN** a required layer returns malformed rows, duplicate codes, a row count
  below its completeness safety floor, an untolerated hierarchy error, or
  inconsistent package content
- **THEN** the system persists structured validation findings
- **AND** the candidate cannot replace the active version

#### Scenario: ROP version is bootstrapped
- **WHEN** the existing generated ROP resource is imported into typed
  projections and private artifacts
- **THEN** validation proves exact entry, term, geography, join-issue count, and
  canonical checksum parity before activation
