## MODIFIED Requirements

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
