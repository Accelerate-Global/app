## ADDED Requirements

### Requirement: Map layout prioritizes geography

The system SHALL place local map search above a full-width map and SHALL place selected-country record results below the map so a fixed desktop sidebar does not reduce the geography's primary width.

#### Scenario: User opens Map mode on desktop

- **WHEN** an authenticated user opens Map mode on a desktop viewport
- **THEN** the map uses the full content width within the map card
- **AND** search and selected-country results remain available outside the map canvas

#### Scenario: User opens Map mode on a narrow viewport

- **WHEN** the map is rendered on a narrow viewport
- **THEN** search, map, legend, and record results remain in a usable vertical order
- **AND** the page does not require horizontal scrolling

### Requirement: Count intensity and country selection are visually distinct

The system MUST use country fill color only for matching-record intensity and MUST use a consistent, non-dominating outline treatment for the selected country at every supported zoom.

#### Scenario: User selects countries of different geographic sizes

- **WHEN** the user selects either a large country or a small country
- **THEN** its matching-record fill remains consistent with the legend
- **AND** its selection outline remains visible without obscuring nearby boundaries

#### Scenario: User zooms the selected country

- **WHEN** the selected country is viewed at world zoom and at focused zoom
- **THEN** the selection treatment retains the same semantic meaning
- **AND** selection is also identified by accessible text outside the map

### Requirement: Selected map records can be inspected and scoped into the table

The system SHALL expose every mapped record for a selected country, allow individual record selection, and provide actions to view either all country records or the selected subset in the existing dataset table.

#### Scenario: User views all records for a country

- **WHEN** the user selects a country and activates `View all in Table`
- **THEN** the application switches to Table mode showing exactly that country's mapped record IDs within the current canonical filters
- **AND** a visible temporary-scope banner identifies the country and record count

#### Scenario: User views selected records for a country

- **WHEN** the user checks one or more country records and activates `View selected in Table`
- **THEN** the application switches to Table mode showing exactly those selected record IDs
- **AND** the action is disabled when no records are selected

#### Scenario: User clears the temporary map scope

- **WHEN** the user clears the map-derived table scope
- **THEN** the table again shows the complete canonical filtered row set
- **AND** the canonical Region, Country, Watchlist, UUPG, and Hotspots state is unchanged

#### Scenario: Selected country contains many records

- **WHEN** the selected country has more records than the initial bounded result batch
- **THEN** `View all in Table` still includes the complete country record set
- **AND** the user can progressively reveal additional individually selectable records without unbounded page growth

### Requirement: One dataset record has a read-only profile

The system SHALL allow a user to open one dataset row from the map's country results or from the table in a read-only profile sheet using the dataset's visible fields.

#### Scenario: User opens a record from map results

- **WHEN** the user activates one record name in a selected country's result panel
- **THEN** a read-only profile sheet identifies that record
- **AND** displays its visible dataset field labels and formatted values

#### Scenario: User opens a record from the table

- **WHEN** the user activates a displayed table row
- **THEN** the same read-only profile sheet opens for that row

#### Scenario: Record contains untrusted-looking text

- **WHEN** a record field contains text resembling markup or script
- **THEN** the profile displays it as text
- **AND** does not interpret it as executable or popup content

### Requirement: Map record drill-down remains temporary and local

Map record selection and table scoping MUST remain client-local, MUST NOT modify source rows or saved filters, and MUST NOT introduce third-party runtime requests.

#### Scenario: User scopes records and returns to Map mode

- **WHEN** the user views a map-derived subset in Table mode and later returns to Map mode
- **THEN** the map continues to represent the complete canonical filtered row set
- **AND** the temporary table scope remains clearable without changing saved filter state

#### Scenario: Maintainer observes map drill-down requests

- **WHEN** search, selection, table handoff, and record profile interactions are exercised
- **THEN** they operate on already loaded same-origin dataset rows
- **AND** no geocoder, hosted map, or external profile request is made
