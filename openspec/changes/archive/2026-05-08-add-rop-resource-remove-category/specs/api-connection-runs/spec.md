## ADDED Requirements

### Requirement: API connection resources omit category metadata
The system SHALL persist API connection run resources without category
metadata while preserving URL, display text, and source provenance metadata.

#### Scenario: Successful run publishes resources
- **WHEN** a saved API connection run output contains indexed resource URL fields
- **THEN** the system persists each valid deduplicated resource URL
- **AND** the persisted resource includes display text when present
- **AND** the persisted resource includes source row and source resource indexes
- **AND** the persisted resource does not include category metadata

#### Scenario: Admin views captured resources
- **WHEN** a dataset admin opens `/dashboard/api-connections` after resources have been captured
- **THEN** captured resource rows show display text and URL
- **AND** captured resource rows do not show category metadata or an uncategorized placeholder
