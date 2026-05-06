## MODIFIED Requirements

### Requirement: Country-code resource is searchable and copyable
The system SHALL allow users to interact with the country and territory resource
without changing workspace data.

#### Scenario: User searches by name, alias, code, or classification
- **WHEN** a user searches the resource by country or territory name, alias,
  ISO/GENC/FIPS code, numeric code, status, or classification
- **THEN** the page filters the visible rows to matching entries
- **AND** hidden detail fields remain searchable

#### Scenario: User scans the resource table
- **WHEN** a user views the country-code resource table
- **THEN** the table shows country/territory, status, ISO3, FIPS, and GENC3
  columns
- **AND** the table does not show ISO2, numeric, alternative names,
  classification, or copy columns

#### Scenario: User uses the resource controls
- **WHEN** a user views the country-code resource controls
- **THEN** search, visible count, and download appear in one responsive control
  row
- **AND** refresh appears in that same row only for admins

#### Scenario: User opens a country or territory detail sheet
- **WHEN** a user selects a visible country or territory row
- **THEN** a right-side detail sheet opens for that row
- **AND** the sheet shows ISO2, numeric, alternative names, classification,
  source identifiers, and copy actions

#### Scenario: User changes row status for the session
- **WHEN** a user changes a row between active and inactive in the detail sheet
- **THEN** the row status updates in the current browser session
- **AND** the change does not write workspace data

#### Scenario: User adds an alternative name for the session
- **WHEN** a user adds a non-empty alternative name in the detail sheet
- **THEN** the name appears in the row details for the current browser session
- **AND** the new alias participates in resource search
- **AND** exact duplicates of the display name or existing aliases are ignored

#### Scenario: User copies a primary code
- **WHEN** a user copies a selected resource row from the detail sheet
- **THEN** the system copies the row primary alpha-3 code when present
- **AND** the system copies the row GENC alpha-3 code when the row has no
  primary alpha-3 code

#### Scenario: User copies a FIPS code
- **WHEN** a selected resource row has a FIPS code
- **THEN** the user can copy that FIPS code separately from the detail sheet

#### Scenario: User downloads visible resource rows
- **WHEN** a signed-in user downloads the visible resource data
- **THEN** the system provides a CSV file containing the current visible entries
- **AND** the download action is labeled for non-technical users

### Requirement: Country-code resource can refresh from source data
The system SHALL support admin-only refreshing of the country and territory
resource from ISO OBP plus external GENC and legacy FIPS sources without
requiring database writes.

#### Scenario: Admin refreshes source-enriched data in the UI
- **WHEN** a dataset admin requests a live refresh from the web UI
- **THEN** the page shows staged refresh progress
- **AND** the system fetches ISO, GENC, and legacy FIPS data
- **AND** the system reapplies the curated CSV overlay before updating the
  visible list for the current browser session

#### Scenario: Non-admin views source-enriched data
- **WHEN** a signed-in non-admin user views the country-code resource page
- **THEN** the page does not show the refresh action
- **AND** the user can still download visible resource rows

#### Scenario: Non-admin calls refresh API
- **WHEN** a signed-in non-admin user calls the country-code refresh API
- **THEN** the API returns `403 Forbidden`
- **AND** the source refresh does not run

#### Scenario: Source refresh fails
- **WHEN** any required external source is unavailable or returns invalid data
- **THEN** the page keeps the last loaded generated list visible and shows a
  refresh error

#### Scenario: Developer refreshes the generated resource
- **WHEN** a developer runs the country-code refresh command
- **THEN** the generated app resource is rewritten with the source-enriched
  curated country and territory rows
