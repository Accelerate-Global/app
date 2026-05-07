# dashboard-layout Specification

## Purpose
Defines the shared authenticated dashboard page width and table header selection
behavior so dashboard surfaces align consistently and table body content remains
selectable.
## Requirements
### Requirement: Dashboard pages use a consistent content width
The system SHALL render authenticated dashboard pages with one shared desktop
content width.

#### Scenario: User navigates between dashboard pages
- **WHEN** a signed-in user opens renderable dashboard pages on desktop
- **THEN** each page uses the same maximum content width
- **AND** the site header aligns to that same maximum width

#### Scenario: User views narrow dashboard content
- **WHEN** a dashboard page contains narrow content such as a profile form or a
  single resource card
- **THEN** the outer page content still uses the shared dashboard width
- **AND** inner controls can keep their own readable width

### Requirement: Table headers are not text-selectable
The system SHALL prevent accidental text selection of table headers while
preserving selectable table body content.

#### Scenario: User drags across a standard table header
- **WHEN** a user drags across a shared table header cell
- **THEN** the header text does not become selected
- **AND** body cell text remains selectable

#### Scenario: User drags across a DataGrid header
- **WHEN** a user drags across a dataset DataGrid header cell
- **THEN** the header text does not become selected
- **AND** existing resize and drag affordances still work
