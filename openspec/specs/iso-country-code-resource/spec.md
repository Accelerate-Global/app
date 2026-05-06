# iso-country-code-resource Specification

## Purpose
Define the authenticated ISO 3166-1 country-code reference resource, including
official-source refresh behavior, validation expectations, interactive lookup
behavior, and UI smoke coverage.
## Requirements
### Requirement: ISO3 country-code resource is available in the app
The system SHALL provide an authenticated web UI resource containing officially
assigned ISO 3166-1 country entries with English short name, alpha-2 code,
alpha-3 code, numeric code, source URI, and refresh metadata.

#### Scenario: Authenticated user opens country-code resource
- **WHEN** an authenticated user opens the ISO country-code resource page
- **THEN** the page shows the generated country-code list and source metadata

#### Scenario: Anonymous user opens country-code resource
- **WHEN** an anonymous user opens the ISO country-code resource page
- **THEN** the system redirects the user to the sign-in page

### Requirement: Country-code resource is searchable and copyable
The system SHALL allow users to interact with the country-code resource without
changing workspace data.

#### Scenario: User searches by name or code
- **WHEN** a user searches the resource by country name, alpha-2 code, alpha-3
  code, or numeric code
- **THEN** the page filters the visible rows to matching entries

#### Scenario: User copies an ISO3 code
- **WHEN** a user copies a visible country entry
- **THEN** the alpha-3 code is copied and the page shows which code was copied

#### Scenario: User downloads the resource
- **WHEN** a user downloads the visible resource data
- **THEN** the system provides a JSON file containing the current entries and
  source metadata

### Requirement: Country-code resource can refresh from official ISO source
The system SHALL support refreshing the country-code list from ISO's official
Online Browsing Platform without requiring database writes.

#### Scenario: User refreshes from ISO in the UI
- **WHEN** an authenticated user requests a live refresh from the web UI
- **THEN** the system fetches the current official ISO entries and updates the
  visible list for the current browser session

#### Scenario: ISO refresh fails
- **WHEN** the official ISO source is unavailable or returns an invalid list
- **THEN** the page keeps the last loaded generated list visible and shows a
  refresh error

#### Scenario: Developer refreshes the generated resource
- **WHEN** a developer runs the country-code refresh command
- **THEN** the generated app resource is rewritten with the current official ISO
  entries and refresh metadata

### Requirement: Country-code resource validates official-code shape
The system SHALL reject refresh results that are missing required fields,
contain duplicate alpha-2 or alpha-3 codes, or contain suspiciously few
officially assigned country entries.

#### Scenario: Scrape result is valid
- **WHEN** the official ISO scrape returns unique country entries with required
  fields and expected code formats
- **THEN** the refresh succeeds and sorts entries by English short name

#### Scenario: Scrape result is invalid
- **WHEN** the official ISO scrape returns malformed rows, duplicate codes, or a
  partial list below the minimum expected count
- **THEN** the refresh fails without replacing the generated resource

### Requirement: Country-code resource has UI smoke coverage
The system SHALL register the country-code page in the UI smoke route registry
and expose the required smoke markers.

#### Scenario: UI smoke route sweep visits the resource
- **WHEN** UI smoke route coverage is checked
- **THEN** the country-code page has a route-registry entry and exposes a
  matching `data-smoke-page` marker
