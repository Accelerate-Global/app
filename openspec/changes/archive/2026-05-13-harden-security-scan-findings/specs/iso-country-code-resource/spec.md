## MODIFIED Requirements

### Requirement: Country-code resource can refresh from source data
The system SHALL support admin-only refreshing of the country and territory
resource from ISO OBP plus external GENC and legacy FIPS sources while
preserving persisted alternate-name overrides, and the refresh request MUST use
a same-origin protected mutation method.

#### Scenario: Admin refreshes source-enriched data in the UI
- **WHEN** a dataset admin requests a live refresh from the web UI
- **THEN** the page sends the refresh as a `POST` request
- **AND** the page shows staged refresh progress while refresh is running
- **AND** the system fetches ISO, GENC, and legacy FIPS data
- **AND** the system reapplies the curated CSV overlay and persisted
  alternate-name overrides before updating the visible list
- **AND** the progress panel disappears when refresh completes
- **AND** the refresh button shows a green checkmark confirmation before
  returning to the refresh icon

#### Scenario: Source refresh fails
- **WHEN** any required external source is unavailable or returns invalid data
- **THEN** the page keeps the last loaded generated list visible
- **AND** the page shows only the refresh error message, not a failed progress
  panel

#### Scenario: Refresh endpoint receives GET
- **WHEN** a request calls the country and territory refresh endpoint with
  `GET`
- **THEN** the system returns `405 Method Not Allowed`
- **AND** the response identifies `POST` as the allowed method
