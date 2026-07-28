# resource-catalog-navigation Specification

## Purpose
Define direct, accessible navigation from resource summaries to inspectable active reference-resource details.

## Requirements

### Requirement: Every catalog resource has a canonical detail destination
The system SHALL assign every active reference resource one canonical detail route and SHALL navigate resource summaries on both the Connections page and Resources index directly to that route.

#### Scenario: User opens a pipeline resource from Connections
- **WHEN** an authenticated administrator activates a pipeline resource row on the Connections page with pointer or keyboard input
- **THEN** the system opens the detail page for that exact resource
- **AND** it does not route through or return to the generic Resources index

#### Scenario: User opens a resource from the Resources index
- **WHEN** an authenticated user activates any resource card
- **THEN** Country and ROP open their specialized detail pages
- **AND** every pipeline resource opens its exact pipeline-resource detail page

### Requirement: Pipeline resource entries are inspectable and downloadable
The system SHALL let authenticated users inspect, search, paginate, and download the active entries for source aliases, PeopleID3, PEID, Tier 1 priorities, and engagement mappings.

#### Scenario: Active resource detail loads
- **WHEN** an authenticated user opens a supported pipeline-resource detail route
- **THEN** the page identifies the resource, active update time, entry count, and downstream impact
- **AND** renders meaningful resource-specific columns from the active version

#### Scenario: User searches and pages through entries
- **WHEN** a user submits a search or requests the next page
- **THEN** the view reads matching entries from the existing authenticated resource API
- **AND** preserves an understandable empty or error state without exposing raw provider errors

#### Scenario: User downloads a filtered resource
- **WHEN** a user chooses Download after applying a search
- **THEN** the system downloads the exact active resource as CSV using the same search filter

### Requirement: Resource navigation is accessible and visually distinct
The system SHALL expose resource summaries as keyboard-operable navigation and SHALL use distinct semantic icons for the Connections page, its Datasets section, and its Resources section.

#### Scenario: Keyboard navigation is used
- **WHEN** a focused resource row receives Enter or Space
- **THEN** it opens the same canonical resource route as pointer activation

#### Scenario: Connections page headings render
- **WHEN** the Connections page loads
- **THEN** the page, Datasets section, and Resources section use distinct icons appropriate to their level and purpose
