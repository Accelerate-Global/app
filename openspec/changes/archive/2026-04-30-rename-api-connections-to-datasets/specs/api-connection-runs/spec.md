## MODIFIED Requirements

### Requirement: API Connections index lists available connections
The system SHALL present `/dashboard/api-connections` as an admin-only Datasets surface with a simple table of available API connection records.

#### Scenario: Admin browses available connections
- **WHEN** a dataset admin opens `/dashboard/api-connections`
- **THEN** the page shows a `Datasets` heading and a `Connections` table with connection, classification, and last ingestion columns
- **AND** the page does not show search, classification filter, status filter, or index status column controls

#### Scenario: Admin selects a connection
- **WHEN** a dataset admin clicks or keyboard-selects an API connection row
- **THEN** the system navigates to that connection's dedicated dashboard page
