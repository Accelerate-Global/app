## MODIFIED Requirements

### Requirement: Country and territory code resource is available in the app
The system SHALL provide an authenticated country and territory code resource
whose rows come from the curated Accelerate Global ISO3 overlay and whose code
metadata is enriched from ISO OBP, GENC, and legacy FIPS sources.

#### Scenario: Authenticated user opens country-code resource
- **WHEN** an authenticated user opens the country-code resource page
- **THEN** the page shows the generated country and territory code list with
  source metadata
- **AND** the generated metadata reports the curated entry count, official ISO
  count, and active row count

#### Scenario: Anonymous user opens country-code resource
- **WHEN** an anonymous user opens the country-code resource page
- **THEN** the system redirects the user to the sign-in page

### Requirement: Country-code resource is searchable and copyable
The system SHALL allow users to interact with the country and territory resource
without changing workspace data.

#### Scenario: User searches by name, alias, code, or classification
- **WHEN** a user searches the resource by country or territory name, alias,
  ISO/GENC/FIPS code, numeric code, status, or classification
- **THEN** the page filters the visible rows to matching entries

#### Scenario: User copies a primary code
- **WHEN** a user copies a visible resource row
- **THEN** the system copies the row primary alpha-3 code when present
- **AND** the system copies the row GENC alpha-3 code when the row has no
  primary alpha-3 code

#### Scenario: User copies a FIPS code
- **WHEN** a visible resource row has a FIPS code
- **THEN** the user can copy that FIPS code separately

#### Scenario: User downloads the resource
- **WHEN** a user downloads the visible resource data
- **THEN** the system provides a JSON file containing the current entries and
  source metadata

### Requirement: Country-code resource can refresh from source data
The system SHALL support refreshing the country and territory resource from ISO
OBP plus external GENC and legacy FIPS sources without requiring database writes.

#### Scenario: User refreshes source-enriched data in the UI
- **WHEN** an authenticated user requests a live refresh from the web UI
- **THEN** the system fetches ISO, GENC, and legacy FIPS data
- **AND** the system reapplies the curated CSV overlay before updating the
  visible list for the current browser session

#### Scenario: Source refresh fails
- **WHEN** any required external source is unavailable or returns invalid data
- **THEN** the page keeps the last loaded generated list visible and shows a
  refresh error

#### Scenario: Developer refreshes the generated resource
- **WHEN** a developer runs the country-code refresh command
- **THEN** the generated app resource is rewritten with the source-enriched
  curated country and territory rows

### Requirement: Country-code resource validates official-code shape
The system SHALL reject refresh results that have malformed official ISO rows,
malformed GENC rows, malformed resource entries, suspiciously few official ISO
or GENC entries, or a curated overlay count that does not match the committed
row universe.

#### Scenario: Source-enriched result is valid
- **WHEN** all sources return valid data and the curated overlay can be applied
- **THEN** the refresh succeeds and preserves every curated country/territory row

#### Scenario: Source-enriched result is invalid
- **WHEN** a source returns malformed rows or the overlay merge omits curated
  rows
- **THEN** the refresh fails without replacing the generated resource

### Requirement: Country-code resource appears in API Connections Resources
The system SHALL show the country and territory code resource as a built-in
reference resource in the API Connections Resources area.

#### Scenario: Admin views API Connections resources
- **WHEN** a dataset admin opens the API Connections page
- **THEN** the Resources area includes the country and territory code resource
  with a link to the authenticated country-code resource page
