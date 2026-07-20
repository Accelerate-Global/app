## MODIFIED Requirements

### Requirement: Admin Datasets Resources card includes built-in reference resources
The system SHALL show dataset admins catalog-backed built-in resources and
captured ingestion resources in a metadata table within the Connections
Resources card.

#### Scenario: Admin views built-in resources on Connections page
- **WHEN** a dataset admin opens `/dashboard/api-connections`
- **THEN** the Resources card includes the active Country & territory code resource
- **AND** the Resources card includes the active ROP Codes resource
- **AND** the Country & territory code row opens `/dashboard/country-codes`
- **AND** the ROP Codes row opens `/dashboard/rop-codes`

#### Scenario: Admin views Resources rows
- **WHEN** a dataset admin views the Resources card on `/dashboard/api-connections`
- **THEN** the Resources card uses the same table and row-divider treatment as Dataset sources
- **AND** the table has `Source`, `Entries`, and `Last updated` columns
- **AND** built-in rows show their active-version entry count and source retrieval time
- **AND** captured rows show their capture time and do not invent an entry count
- **AND** the Resources card does not show visible Category, Display text, URL, or Open columns

#### Scenario: Registered catalog metadata changes
- **WHEN** an admin-approved catalog label or route changes
- **THEN** both reference-resource discovery surfaces use the same persisted metadata
- **AND** no separate hard-coded card registry must be updated
