## ADDED Requirements

### Requirement: API Connections index lists available connections
The system SHALL present the admin API Connections index as a searchable, filterable table of available API connection records.

#### Scenario: Admin browses available connections
- **WHEN** a dataset admin opens `/dashboard/api-connections`
- **THEN** the page shows available API connections in a table with connection, classification, last ingestion, and status columns

#### Scenario: Admin filters available connections
- **WHEN** a dataset admin searches by connection text or filters by classification or status
- **THEN** the list updates without exposing URL, header, body, response parsing, or web profile editing controls

#### Scenario: Admin selects a connection
- **WHEN** a dataset admin clicks or keyboard-selects an API connection row
- **THEN** the system navigates to that connection's dedicated dashboard page

### Requirement: API connection detail dashboard supports run operations
The system SHALL provide an admin-only detail page for each API connection that supports existing test and import run operations.

#### Scenario: Admin views a connection detail page
- **WHEN** a dataset admin opens `/dashboard/api-connections/{connectionId}` for a known materialized or repo-owned connection
- **THEN** the page shows the connection name, description, current status, pipeline skeleton, run actions, ingestion history, and selected run detail

#### Scenario: Unknown connection detail page
- **WHEN** a dataset admin opens `/dashboard/api-connections/{connectionId}` for an unknown connection
- **THEN** the system returns the normal not-found route behavior

#### Scenario: Non-admin cannot view detail page
- **WHEN** an unauthenticated user or non-admin user opens a connection detail page
- **THEN** the system applies the existing API Connections admin redirect behavior

### Requirement: Pipeline stages are visual skeleton only
The system SHALL show pipeline stages for a selected API connection while keeping independent stage execution disabled in v1.

#### Scenario: Admin views pipeline skeleton
- **WHEN** a dataset admin views an API connection detail page
- **THEN** the page shows Configure, Fetch, Normalize, Archive Output, and Import Dataset stages as disabled coming-soon controls

#### Scenario: Admin starts supported v1 work
- **WHEN** a dataset admin starts a run from the detail page
- **THEN** `Run test` uses the existing test run behavior and `Start ingestion` uses the existing import run behavior

### Requirement: Ingestion history uses DataGrid
The system SHALL list each initiated run for a connection as an ingestion row using the existing DataGrid table interface.

#### Scenario: Admin views ingestion history
- **WHEN** a dataset admin views a connection detail page
- **THEN** the DataGrid lists runs with initiated time, mode, status, started time, completed time, duration, row count, HTTP status, actor, and artifact actions

#### Scenario: Admin selects an ingestion row
- **WHEN** a dataset admin selects an ingestion row
- **THEN** the page shows that run's logs, error, preview, output downloads, and imported dataset link when available
