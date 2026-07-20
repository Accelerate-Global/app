# iso-country-code-resource Specification

## Purpose
Define the authenticated country and territory code reference resource,
including ISO, UNTERM, UNSD M49, GENC, legacy FIPS, ROG3, curated-overlay
refresh behavior, validation expectations, interactive lookup behavior, and UI
smoke coverage.
## Requirements
### Requirement: Country and territory code resource is available in the app
The system SHALL provide the active persisted country and territory code version
generated from curated CSV, ISO OBP, UNTERM, UNSD M49, GENC, legacy FIPS, and
ROG3/GEC cross-reference sources.

#### Scenario: Authenticated user opens country-code resource
- **WHEN** an authenticated user opens the country-code resource page
- **THEN** the page shows the active persisted country and territory code version
- **AND** the page avoids a duplicate in-card resource title and generated
  metadata sentence
- **AND** the page provides a back link to `/dashboard/resources`
- **AND** the page identifies the active version and retrieval time
- **AND** the resource includes the curated entry count, official ISO count,
  active row count, source metadata, and deterministic checksum
- **AND** each entry exposes separate nullable `fips` and `rog3` fields

#### Scenario: Active country-code version is unavailable
- **WHEN** the catalog is initialized but has no healthy active Country/ROG
  version
- **THEN** the page reports an operational resource error
- **AND** the system does not silently substitute the checked-in generated file

#### Scenario: Anonymous user opens country-code resource
- **WHEN** an anonymous user opens the country-code resource page
- **THEN** the system redirects the user to the sign-in page

### Requirement: Country-code resource is searchable and copyable
The system SHALL allow signed-in users to search, inspect, download, and, for
admins only, maintain versioned alternate names for the active country and
territory resource.

#### Scenario: User uses the resource controls
- **WHEN** a signed-in user views the country-code resource controls
- **THEN** the page shows search and download controls
- **AND** search includes country or territory name, alias, ISO, FIPS, ROG3,
  GENC, status, official names, and classification fields across the complete
  active version
- **AND** the page does not show a visible row-count badge
- **AND** refresh appears only for admins

#### Scenario: User opens a country or territory detail sheet
- **WHEN** a user selects a visible country or territory row
- **THEN** a right-side detail sheet opens for that row
- **AND** the sheet title is the country or territory name
- **AND** the sheet shows ISO2, numeric, FIPS, ROG3, alternative names,
  classification, and source identifiers
- **AND** the sheet does not show code copy actions

#### Scenario: Admin adds an alternative name
- **WHEN** a dataset admin adds a non-empty alternative name in the detail sheet
- **THEN** the system derives and validates a new immutable Country/ROG version
  from the active version
- **AND** the system atomically activates that version with an alias-edit audit
  event
- **AND** every signed-in user sees the updated alternate names on later page
  loads
- **AND** the new alias participates in resource search and CSV download
- **AND** exact duplicates of the display name or existing aliases are ignored

#### Scenario: Admin deletes an alternative name
- **WHEN** a dataset admin deletes an existing alternative name in the detail
  sheet
- **THEN** the system derives, validates, and activates a new immutable
  Country/ROG version with an alias-edit audit event
- **AND** later searches and downloads omit the deleted alias

#### Scenario: Non-admin views alternate names
- **WHEN** a signed-in non-admin opens a country or territory detail sheet
- **THEN** the user can read alternate names
- **AND** the user cannot add or delete alternate names

#### Scenario: Non-admin calls alternate-name API
- **WHEN** a signed-in non-admin calls the alternate-name API
- **THEN** the API returns `403 Forbidden`
- **AND** no derived resource version or alias change is written

#### Scenario: Anonymous user calls alternate-name API
- **WHEN** an anonymous user calls the alternate-name API
- **THEN** the API returns `401 Unauthorized`
- **AND** no derived resource version or alias change is written

#### Scenario: User downloads filtered resource rows
- **WHEN** a signed-in user downloads the current country-code query
- **THEN** the system provides a CSV containing every matching entry from the
  active version
- **AND** versioned alternate names are reflected in the CSV
- **AND** the CSV includes separate FIPS and ROG3 columns
- **AND** the download action is labeled for non-technical users

### Requirement: Country-code resource can refresh from source data
The system SHALL support admin-only creation of a persistent Country/ROG
candidate from ISO OBP plus external UNTERM, M49, GENC, legacy FIPS, and ROG3
cross-reference sources, and lifecycle mutations MUST use same-origin protected
methods.

#### Scenario: Admin refreshes source-enriched data in the UI
- **WHEN** a dataset admin requests a live refresh from the web UI
- **THEN** the page sends the refresh as a `POST` request
- **AND** the page shows persisted staged build progress while refresh is running
- **AND** the system fetches ISO, UNTERM, M49, GENC, legacy FIPS, and ROG3
  cross-reference data
- **AND** the system reapplies the curated CSV content and active version's
  alternate names before validating the candidate
- **AND** a successful build produces candidate metadata, validation results,
  and an active-version diff rather than replacing the visible resource

#### Scenario: Admin activates a valid country-code candidate
- **WHEN** a dataset admin reviews a valid candidate and confirms activation
  with a reason
- **THEN** the candidate becomes the active persisted Country/ROG version
- **AND** later page loads, searches, details, and downloads use that version
- **AND** the UI confirms activation before returning to its idle state

#### Scenario: Source refresh fails
- **WHEN** any required external source is unavailable or returns invalid data
- **THEN** the page keeps the active persisted version visible
- **AND** the admin can inspect the normalized failure or validation findings
- **AND** no invalid candidate can be activated

#### Scenario: Refresh endpoint receives GET
- **WHEN** a request calls the country and territory refresh endpoint with `GET`
- **THEN** the system returns `405 Method Not Allowed`
- **AND** the response identifies `POST` as the allowed method

### Requirement: Country-code resource validates official-code shape
The system SHALL mark a candidate invalid when it has malformed official ISO
rows, malformed GENC rows, malformed ROG3 rows, malformed resource entries,
suspiciously few official ISO, GENC, or ROG3 entries, a curated overlay count
that does not match the committed row universe, or package integrity failures.

#### Scenario: Source-enriched candidate is valid
- **WHEN** all sources return valid data, the curated overlay can be applied,
  artifacts match projections, and package counts/checksum are consistent
- **THEN** the candidate becomes eligible for explicit activation
- **AND** it preserves every curated country/territory row
- **AND** ROG3 source blanks remain null instead of being copied from FIPS

#### Scenario: Source-enriched candidate is invalid
- **WHEN** a source returns malformed rows, the overlay merge omits curated rows,
  or package integrity checks fail
- **THEN** the system persists structured validation findings
- **AND** the candidate cannot replace the active version

#### Scenario: Country-code version is bootstrapped
- **WHEN** the existing generated Country/ROG resource and alternate-name
  overrides are imported
- **THEN** validation proves exact content/count parity before activation
- **AND** the legacy mutable override path is not required after cutover

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

### Requirement: Country-code lifecycle surfaces have UI smoke coverage
The system SHALL register every new country-code candidate, validation, version
history, activation, rejection, and rollback sheet or dialog for UI smoke.

#### Scenario: UI smoke opens country-code lifecycle controls
- **WHEN** UI smoke exercises an admin country-code lifecycle control
- **THEN** its trigger, surface, and ready markers match the registered smoke
  fixture or targeted route interaction
