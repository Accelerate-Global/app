# iso-country-code-resource Specification

## Purpose
Define the authenticated country and territory code reference resource,
including ISO, GENC, legacy FIPS, curated-overlay refresh behavior, validation
expectations, interactive lookup behavior, and UI smoke coverage.
## Requirements
### Requirement: Country and territory code resource is available in the app
The system SHALL provide an authenticated country and territory code resource
whose rows come from the curated Accelerate Global ISO3 overlay and whose code
metadata is enriched from ISO OBP, GENC, and legacy FIPS sources.

#### Scenario: Authenticated user opens country-code resource
- **WHEN** an authenticated user opens the country-code resource page
- **THEN** the page shows the generated country and territory code list
- **AND** the page avoids a duplicate in-card resource title and generated
  metadata sentence
- **AND** the page provides a back link to `/dashboard/resources`
- **AND** the resource JSON still includes the curated entry count, official ISO
  count, active row count, and source metadata

#### Scenario: Anonymous user opens country-code resource
- **WHEN** an anonymous user opens the country-code resource page
- **THEN** the system redirects the user to the sign-in page

### Requirement: Country-code resource is searchable and copyable
The system SHALL allow signed-in users to search, inspect, download, and, for
admins only, maintain alternate names for the country and territory resource.

#### Scenario: User uses the resource controls
- **WHEN** a signed-in user views the country-code resource controls
- **THEN** the page shows search and download controls
- **AND** the page does not show a visible row-count badge
- **AND** refresh appears only for admins

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

### Requirement: Country-code resource appears in API Connections Resources
The system SHALL show the country and territory code resource as a built-in
reference resource in the API Connections Resources area.

#### Scenario: Admin views API Connections resources
- **WHEN** a dataset admin opens the API Connections page
- **THEN** the Resources area includes the country and territory code resource
  with a link to the authenticated country-code resource page

### Requirement: Country-code resource includes official UN names linked to ISO3
The system SHALL enrich country and territory resource entries with official
UNTERM English short names and any provided formal names when those names can
be linked to an ISO-alpha3 code through UNSD M49.

#### Scenario: Refresh links UNTERM names through M49
- **WHEN** an admin refreshes the country and territory resource and UNTERM and
  M49 sources return valid data
- **THEN** entries whose ISO3 code matches the M49 bridge include the UNTERM
  English short name, any provided UNTERM English formal name, and a UNTERM/M49
  source marker
- **AND** entries without a bridgeable UNTERM row keep null official-name fields

#### Scenario: Official names remain separate from curated aliases
- **WHEN** a refreshed entry has official UNTERM names and curated alternate
  names
- **THEN** the official UNTERM names are exposed in dedicated fields
- **AND** the curated alternate-name list remains editable only through the
  existing admin alternate-name workflow

#### Scenario: Official-name source is unavailable
- **WHEN** UNTERM or M49 returns malformed data or cannot be parsed
- **THEN** the refresh fails without replacing the currently visible generated
  resource

### Requirement: Country-code UI exposes official UN names
The system SHALL show official UNTERM English short names and any provided
formal names as read-only source fields in the country and territory resource.

#### Scenario: User opens a bridged entry
- **WHEN** a signed-in user opens a country or territory detail sheet for an
  entry with bridged UNTERM names
- **THEN** the sheet shows the official UN short name and official UN formal
  name separately from alternate names

#### Scenario: User searches official names
- **WHEN** a signed-in user searches by an official UNTERM short or formal name
- **THEN** matching country and territory rows remain visible in the resource
  table

#### Scenario: User downloads resource rows
- **WHEN** a signed-in user downloads visible country and territory rows
- **THEN** the CSV includes the official UN short name, official UN formal name,
  and official-name source fields
