## ADDED Requirements

### Requirement: API connection runs persist referenced resources
The system SHALL persist referenced document resources extracted from successful API connection output rows while preserving run history.

#### Scenario: Successful run publishes resources
- **WHEN** a test or import API connection run succeeds with parsed rows containing `Resource_##_URL` fields
- **THEN** the system stores valid HTTP(S) resources in `private.api_connection_resources` before marking the run successful

#### Scenario: Invalid resources are skipped
- **WHEN** parsed resource fields have blank, invalid, or non-HTTP(S) URLs
- **THEN** the system does not store those resource entries

#### Scenario: Duplicate URLs are collapsed within a run
- **WHEN** one run output contains multiple resources with the same parsed URL after removing the hash
- **THEN** the system stores one resource row for that connection, run, and normalized URL

### Requirement: API Connections index shows captured resources
The system SHALL show a second read-only Resources grid on the admin API Connections index.

#### Scenario: Admin views captured resources
- **WHEN** a dataset admin opens `/dashboard/api-connections`
- **THEN** the page shows the newest 500 persisted resources with category, display text, URL, and Open action columns below the API Connections grid

#### Scenario: No resources exist
- **WHEN** no resources have been captured
- **THEN** the Resources grid shows an empty state without offering create, update, or delete controls
