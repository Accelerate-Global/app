## MODIFIED Requirements

### Requirement: Country-code resource is searchable and copyable
The system SHALL allow signed-in users to search, inspect, download, and, for
admins only, maintain alternate names for the country and territory resource.

#### Scenario: User opens a country or territory detail sheet
- **WHEN** a user selects a visible country or territory row
- **THEN** a right-side detail sheet opens for that row
- **AND** the sheet title is the country or territory name
- **AND** the sheet shows ISO2, numeric, alternative names, classification, and
  source identifiers
- **AND** the sheet does not show code copy actions

#### Scenario: Admin adds an alternative name
- **WHEN** a dataset admin adds a non-empty alternative name in the detail sheet
- **THEN** the system persists the updated alternate-name list for that country
  or territory
- **AND** every signed-in user sees the updated alternate names on later page
  loads
- **AND** the new alias participates in resource search and CSV download
- **AND** exact duplicates of the display name or existing aliases are ignored

#### Scenario: Admin deletes an alternative name
- **WHEN** a dataset admin deletes an existing alternative name in the detail
  sheet
- **THEN** the system persists the updated alternate-name list for that country
  or territory
- **AND** later searches and downloads omit the deleted alias

#### Scenario: Non-admin views alternate names
- **WHEN** a signed-in non-admin opens a country or territory detail sheet
- **THEN** the user can read alternate names
- **AND** the user cannot add or delete alternate names

#### Scenario: Non-admin calls alternate-name API
- **WHEN** a signed-in non-admin calls the alternate-name API
- **THEN** the API returns `403 Forbidden`
- **AND** the alternate-name override is not written

#### Scenario: Anonymous user calls alternate-name API
- **WHEN** an anonymous user calls the alternate-name API
- **THEN** the API returns `401 Unauthorized`
- **AND** the alternate-name override is not written

#### Scenario: User downloads visible resource rows
- **WHEN** a signed-in user downloads the visible resource data
- **THEN** the system provides a CSV file containing the current visible entries
- **AND** persisted alternate-name overrides are reflected in the CSV
- **AND** the download action is labeled for non-technical users

### Requirement: Country-code resource can refresh from source data
The system SHALL support admin-only refreshing of the country and territory
resource from ISO OBP plus external GENC and legacy FIPS sources while
preserving persisted alternate-name overrides.

#### Scenario: Admin refreshes source-enriched data in the UI
- **WHEN** a dataset admin requests a live refresh from the web UI
- **THEN** the page shows staged refresh progress while refresh is running
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
