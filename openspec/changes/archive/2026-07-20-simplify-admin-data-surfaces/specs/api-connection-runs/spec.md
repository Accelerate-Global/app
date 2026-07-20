## MODIFIED Requirements

### Requirement: API Connections index lists available connections
The system SHALL present `/dashboard/api-connections` as an admin-only
Connections surface with a `Dataset sources` card containing a simple table of
available API connection records and a separate Resources metadata table.

#### Scenario: Admin browses available connections
- **WHEN** a dataset admin opens `/dashboard/api-connections`
- **THEN** the page shows a `Connections` heading and a `Dataset sources` card
  with an `Add connection` action and a table with source, classification, and
  last ingestion columns
- **AND** the Add connection action opens the existing Google Sheets connection workflow
- **AND** the Dataset sources card does not show search, classification filter,
  status filter, index status column controls, or inline source onboarding
- **AND** the separate Resources card presents Source, Entries, and Last updated columns

#### Scenario: Admin selects a connection
- **WHEN** a dataset admin clicks or keyboard-selects an API connection row
- **THEN** the system navigates to that connection's dedicated dashboard page
