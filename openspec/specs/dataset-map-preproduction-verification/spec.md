# dataset-map-preproduction-verification Specification

## Purpose
Define the disposable, production-shaped local verification suite that proves table/map filter parity, representative map interactions, role boundaries, responsive behavior, and provider-free operation before release.

## Requirements
### Requirement: Production-shaped local map dataset
The verification system SHALL provide a disposable local dataset with at least 1,500 deterministic records derived from the repository-owned country catalog, including representative country aliases, varied filter fields, and records that cannot be mapped to bundled boundaries.

#### Scenario: Large fixture is bootstrapped
- **WHEN** dataset smoke data is prepared for local verification
- **THEN** a separate workspace-visible map pre-production dataset exists without reading or modifying production data
- **AND** its records exercise multi-page loading, mapped geography, and unmapped geography

### Requirement: Filtered table and map parity
The browser suite SHALL verify that the map uses the same filtered record set as the table across Region, Country, Watchlist, UUPG, and Hotspots controls.

#### Scenario: Filter changes preserve parity
- **WHEN** an authenticated Pro user applies each supported filter category to the production-shaped dataset
- **THEN** the sum of mapped and unmapped map records equals the visible filtered-table count
- **AND** each exercised filter produces a nonempty result smaller than the unfiltered dataset

#### Scenario: Empty result remains understandable
- **WHEN** filters produce zero records
- **THEN** both table and map show their existing empty-result states without blocking other dataset actions

### Requirement: Representative map interaction coverage
The browser suite SHALL verify local country and people-group search, textual country summaries, keyboard country selection, mobile layout, dark appearance, and authorized role access on the production-shaped dataset.

#### Scenario: Search and keyboard selection work
- **WHEN** a user searches for a representative country or people group or activates a rendered country by keyboard
- **THEN** the map shows the matching country summary and focused record context

#### Scenario: Mobile dark layout remains usable
- **WHEN** a Pro user opens the large map on a mobile viewport with dark appearance
- **THEN** the map becomes ready, the page does not overflow horizontally, and textual controls remain usable

#### Scenario: Workspace roles retain access boundaries
- **WHEN** Basic, Pro, and Admin users open the workspace-visible large dataset
- **THEN** each role can view the map and only role-appropriate actions are exposed

### Requirement: Provider-free and bounded local verification
The browser suite SHALL prove that opening and exercising the production-shaped map performs no third-party map requests and becomes ready within a generous local no-freeze ceiling.

#### Scenario: Map stays local and responsive
- **WHEN** the large map is opened during local browser verification
- **THEN** its boundary request is same-origin
- **AND** no third-party map request is observed
- **AND** the map reports ready within thirty seconds

### Requirement: Human-only boundary approval remains explicit
The release process MUST NOT treat automated map rendering as approval of disputed or politically sensitive boundary representations.

#### Scenario: Automated suite completes
- **WHEN** all dataset-map verification checks pass
- **THEN** geopolitical boundary acceptance remains an explicit human production-readiness decision
