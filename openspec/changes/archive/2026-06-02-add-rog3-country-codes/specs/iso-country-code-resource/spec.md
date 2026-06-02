## MODIFIED Requirements

### Requirement: Country and territory code resource is available in the app
The system SHALL provide an authenticated country and territory code resource
whose rows come from the curated Accelerate Global ISO3 overlay and whose code
metadata is enriched from ISO OBP, UNTERM, UNSD M49, GENC, legacy FIPS, and
ROG3/GEC cross-reference sources.

#### Scenario: Authenticated user opens country-code resource
- **WHEN** an authenticated user opens the country-code resource page
- **THEN** the page shows the generated country and territory code list
- **AND** the page avoids a duplicate in-card resource title and generated
  metadata sentence
- **AND** the page provides a back link to `/dashboard/resources`
- **AND** the resource JSON still includes the curated entry count, official ISO
  count, active row count, and source metadata
- **AND** each entry exposes separate nullable `fips` and `rog3` fields

### Requirement: Country-code resource is searchable and copyable
The system SHALL allow signed-in users to search, inspect, download, and, for
admins only, maintain alternate names for the country and territory resource.

#### Scenario: User uses the resource controls
- **WHEN** a signed-in user views the country-code resource controls
- **THEN** the page shows search and download controls
- **AND** search includes country or territory name, alias, ISO, FIPS, ROG3,
  GENC, status, official names, and classification fields
- **AND** the page does not show a visible row-count badge
- **AND** refresh appears only for admins

#### Scenario: User opens a country or territory detail sheet
- **WHEN** a user selects a visible country or territory row
- **THEN** a right-side detail sheet opens for that row
- **AND** the sheet title is the country or territory name
- **AND** the sheet shows ISO2, numeric, FIPS, ROG3, alternative names,
  classification, and source identifiers
- **AND** the sheet does not show code copy actions

#### Scenario: User downloads visible resource rows
- **WHEN** a signed-in user downloads the visible resource data
- **THEN** the system provides a CSV file containing the current visible entries
- **AND** persisted alternate-name overrides are reflected in the CSV
- **AND** the CSV includes separate FIPS and ROG3 columns
- **AND** the download action is labeled for non-technical users

### Requirement: Country-code resource can refresh from source data
The system SHALL support admin-only refreshing of the country and territory
resource from ISO OBP plus external UNTERM, M49, GENC, legacy FIPS, and ROG3
cross-reference sources while preserving persisted alternate-name overrides, and
the refresh request MUST use a same-origin protected mutation method.

#### Scenario: Admin refreshes source-enriched data in the UI
- **WHEN** a dataset admin requests a live refresh from the web UI
- **THEN** the page sends the refresh as a `POST` request
- **AND** the page shows staged refresh progress while refresh is running
- **AND** the system fetches ISO, UNTERM, M49, GENC, legacy FIPS, and ROG3
  cross-reference data
- **AND** the system reapplies the curated CSV overlay and persisted
  alternate-name overrides before updating the visible list
- **AND** the progress panel disappears when refresh completes
- **AND** the refresh button shows a green checkmark confirmation before
  returning to the refresh icon

### Requirement: Country-code resource validates official-code shape
The system SHALL reject refresh results that have malformed official ISO rows,
malformed GENC rows, malformed ROG3 rows, malformed resource entries,
suspiciously few official ISO, GENC, or ROG3 entries, or a curated overlay count
that does not match the committed row universe.

#### Scenario: Source-enriched result is valid
- **WHEN** all sources return valid data and the curated overlay can be applied
- **THEN** the refresh succeeds and preserves every curated country/territory row
- **AND** ROG3 source blanks remain null instead of being copied from FIPS

#### Scenario: Source-enriched result is invalid
- **WHEN** a source returns malformed rows or the overlay merge omits curated
  rows
- **THEN** the refresh fails without replacing the generated resource
