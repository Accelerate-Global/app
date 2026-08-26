# dataset-map-exploration Specification

## Purpose
Define the dataset-detail map experience: it visualizes the canonical filtered row set by ISO3, keeps unmappable evidence visible, supports accessible local exploration, and runs from documented same-origin assets without external map providers.

## Requirements
### Requirement: Dataset detail provides a map alternative

The system SHALL provide authenticated users a `Table` / `Map` view choice on
the existing dataset-detail page and SHALL keep `Table` as the initial view.

#### Scenario: User opens an accessible dataset

- **WHEN** an authenticated user opens a dataset they are authorized to read
- **THEN** the dataset detail renders in Table mode
- **AND** the user can switch to Map mode without navigating to another route

#### Scenario: User returns from Map mode

- **WHEN** the user switches from Map mode back to Table mode
- **THEN** the existing table, sorting, filters, downloads, and dataset actions remain available

#### Scenario: User opens a saved table or derived view

- **WHEN** the dataset-detail page is initialized from an accessible saved table or derived view
- **THEN** Map mode uses the same initialized filters and backing rows as Table mode
- **AND** the selected Table/Map mode is not added to the saved-filter state

### Requirement: Map mode uses canonical filtered rows

Map mode MUST visualize the same rows produced by the canonical dataset filter
pipeline for the current Region, Watchlist, Hotspots, UUPG, and Country state
and MUST NOT run an independent filter implementation or row request.

#### Scenario: User changes a supported filter

- **WHEN** the user changes a Region, Watchlist, Hotspots, UUPG, or Country filter while Map mode is open
- **THEN** the map aggregates and summary update from the same filtered row result used by Table mode

#### Scenario: User switches views after filtering

- **WHEN** the user applies filters in either view and switches between Table and Map
- **THEN** both views represent the same matching record set

#### Scenario: Filtered result is empty

- **WHEN** the canonical filter pipeline returns no matching rows
- **THEN** Map mode shows a no-results state
- **AND** the user can still change filters or return to Table mode

### Requirement: Map mode visualizes matching records by country

The system SHALL render one interactive country-level boundary layer and SHALL
shade each mapped country according to its count of matching filtered records.
The legend and summaries MUST identify the displayed measure as matching
records rather than population, priority, or engagement intensity.

#### Scenario: Filtered rows contain valid country geography

- **WHEN** one or more filtered rows resolve unambiguously to a supported country
- **THEN** each matching country is rendered with a fill representing its matching-record count
- **AND** the map shows the total mapped matching-record count

#### Scenario: User selects a rendered country

- **WHEN** the user selects a country polygon or an equivalent textual country control
- **THEN** the map identifies the selected country
- **AND** a textual summary shows its country name and matching-record count

#### Scenario: Hotspots changes country membership

- **WHEN** the user enables or changes Hotspots filtering
- **THEN** the rendered countries and their counts reflect the resulting canonical Hotspots row set
- **AND** the map does not independently rerank countries

### Requirement: Unmappable geography remains visible as evidence

The system MUST count filtered records that cannot be joined unambiguously to a
supported country boundary and MUST NOT silently geocode, correct, mutate, or
drop those records from the map summary.

#### Scenario: Row has blank or unknown geography

- **WHEN** a filtered row has a blank country, an unknown ISO3 value such as `XXX`, or no supported boundary match
- **THEN** the row contributes to the visible unmapped count
- **AND** no external geocoding request is made

#### Scenario: Country name is ambiguous

- **WHEN** a filtered row lacks a valid ISO3 value and its country name does not resolve to exactly one reviewed boundary match
- **THEN** the row remains unmapped
- **AND** the source row is not modified

#### Scenario: No rows are mappable

- **WHEN** filtered rows exist but none resolve to a supported country boundary
- **THEN** Map mode explains that the results lack usable country geography
- **AND** it displays the unmapped-record count

### Requirement: Map search operates on current AX results

Map mode SHALL provide local search across the current filtered result's country
names and primary people-group names. Search MUST operate on already loaded AX
rows and MUST NOT call a public place-search or geocoding provider.

#### Scenario: User searches for a country

- **WHEN** the user enters a country-name query that matches a mapped current result
- **THEN** the search returns the matching country
- **AND** selecting it focuses the country and opens its textual summary

#### Scenario: User searches for a people group

- **WHEN** the user enters a primary people-group-name query that matches a mapped current row
- **THEN** the search returns a bounded matching result
- **AND** selecting it focuses the row's mapped country and identifies the match in the textual summary

#### Scenario: Search has no current match

- **WHEN** a query matches no country or primary people-group name in the current filtered rows
- **THEN** the map search reports no results without changing filters or source data

### Requirement: Map operation is provider-free and same-origin

The MVP MUST render from an application-bundled map library and a same-origin,
documented country-boundary asset. It MUST NOT require a hosted map account,
runtime API key, third-party tiles, remote map styles or fonts, external search,
or geocoding requests. The rendered Map surface MUST NOT display optional
third-party source or provider branding, while maintainers MUST retain the
boundary asset's provenance and license documentation in the repository.

#### Scenario: User opens Map mode

- **WHEN** the map renderer and boundary layer initialize
- **THEN** map code is loaded from the application bundle
- **AND** boundary data is loaded from the AX Online origin
- **AND** no third-party map request is issued
- **AND** no optional third-party source or provider branding is displayed

#### Scenario: Boundary asset provenance is inspected

- **WHEN** a maintainer reviews the bundled country-boundary asset
- **THEN** its source, release, retrieval date, transformation notes, license, and checksum are documented in the repository

### Requirement: Map failure does not disable dataset exploration

The system SHALL isolate map loading and rendering failures from the existing
dataset table and actions and SHALL provide accessible textual interaction for
map search, country summaries, counts, and view switching.

#### Scenario: Boundary or renderer loading fails

- **WHEN** the map boundary asset or client renderer cannot be loaded
- **THEN** Map mode displays a recoverable error state
- **AND** Table mode, filters, downloads, and other dataset actions continue to work

#### Scenario: User operates the map without pointer input

- **WHEN** the user navigates the Map view with a keyboard
- **THEN** the view switch, search results, selected-country summary, and return-to-table action are operable with accessible names

#### Scenario: Dataset values appear in map details

- **WHEN** country or people-group values from a dataset are displayed in Map mode
- **THEN** they are rendered as text rather than interpreted as map-popup HTML

### Requirement: Every official ISO3 is representable

The system MUST include exactly one same-origin visual feature for every official ISO3 code in the repository country catalog. A feature MAY be a country polygon or, when the lightweight polygon source omits that code, a point marker. ISO3 MUST remain authoritative over conflicting country-name text.

#### Scenario: Dataset row contains an official ISO3

- **WHEN** a filtered row contains any official ISO3 from the repository country catalog
- **THEN** the row resolves to the bundled feature with that exact ISO3
- **AND** a conflicting country-name value does not redirect it to another feature

#### Scenario: Official ISO3 has no lightweight polygon

- **WHEN** the 1:110m polygon source omits an official ISO3
- **THEN** the bundled asset contains a labeled point marker for that ISO3
- **AND** the marker uses the same matching-record count, selection, search, and accessible keyboard behavior as a polygon

#### Scenario: Maintainer verifies boundary coverage

- **WHEN** the checked-in map asset is validated against the repository country catalog
- **THEN** all official ISO3 codes are present exactly once
- **AND** no runtime third-party request is required to render either polygons or points
