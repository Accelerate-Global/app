## ADDED Requirements

### Requirement: Admin Datasets Resources card includes built-in reference resources
The system SHALL show dataset admins the built-in reference resources needed
for dataset review from the Datasets Resources card.

#### Scenario: Admin views built-in resources on Datasets page
- **WHEN** a dataset admin opens `/dashboard/api-connections`
- **THEN** the Resources card includes the Country & territory code resource
- **AND** the Resources card includes the ROP Codes resource
- **AND** the Country & territory code row opens `/dashboard/country-codes`
- **AND** the ROP Codes row opens `/dashboard/rop-codes`

#### Scenario: Admin views Resources table columns
- **WHEN** a dataset admin views the Resources card on `/dashboard/api-connections`
- **THEN** the Resources table shows Display text and URL columns
- **AND** the Resources table does not show a Category column
