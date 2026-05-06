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
