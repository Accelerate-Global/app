## MODIFIED Requirements

### Requirement: Country and territory code resource is available in the app
The system SHALL provide an authenticated country and territory code resource
whose rows come from the curated Accelerate Global ISO3 overlay and whose code
metadata is enriched from ISO OBP, GENC, and legacy FIPS sources.

#### Scenario: Authenticated user opens country-code resource
- **WHEN** an authenticated user opens the country-code resource page
- **THEN** the page shows the generated country and territory code list
- **AND** the page avoids a duplicate in-card resource title and generated
  metadata sentence
- **AND** the resource JSON still includes the curated entry count, official ISO
  count, active row count, and source metadata

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
- **AND** hidden detail fields remain searchable

#### Scenario: User scans the resource table
- **WHEN** a user views the country-code resource table
- **THEN** the table shows country/territory, status, ISO3, FIPS, and GENC3
  columns
- **AND** the table does not show ISO2, numeric, alternative names,
  classification, or copy columns

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

#### Scenario: User downloads the resource
- **WHEN** a user downloads the visible resource data
- **THEN** the system provides a JSON file containing the current entries and
  source metadata

### Requirement: Country-code resource has UI smoke coverage
The system SHALL register the country-code page in the UI smoke route registry
and expose the required smoke markers.

#### Scenario: UI smoke route sweep visits the resource
- **WHEN** UI smoke route coverage is checked
- **THEN** the country-code page has a route-registry entry and exposes a
  matching `data-smoke-page` marker

#### Scenario: UI smoke opens the country-code detail sheet
- **WHEN** UI smoke exercises the country-code detail sheet trigger
- **THEN** the detail sheet exposes matching `data-smoke-surface` and
  `data-smoke-ready` markers
