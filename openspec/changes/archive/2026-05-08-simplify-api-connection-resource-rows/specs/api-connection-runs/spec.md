## MODIFIED Requirements

### Requirement: API Connections index shows captured resources
The system SHALL show a second read-only Resources list on the admin API Connections index.

#### Scenario: Admin views captured resources
- **WHEN** a dataset admin opens `/dashboard/api-connections`
- **THEN** the page shows the newest 500 persisted resources below the API
  Connections grid
- **AND** the Resources list renders built-in and captured resources as label-only rows
- **AND** the Resources list does not show visible Category, Display text, URL, or Open columns

#### Scenario: Admin opens a resource row
- **WHEN** a dataset admin clicks or keyboard-selects a Resources row
- **THEN** built-in app resources open through in-app navigation
- **AND** captured external resources open in a new browser tab

#### Scenario: No resources exist
- **WHEN** no resources have been captured
- **THEN** the Resources list shows an empty state without offering create,
  update, delete, or row-level Open controls
