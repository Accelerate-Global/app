## MODIFIED Requirements

### Requirement: Admin Datasets Resources card includes built-in reference resources
The system SHALL show dataset admins the built-in reference resources needed
for dataset review from the Datasets Resources card.

#### Scenario: Admin views built-in resources on Datasets page
- **WHEN** a dataset admin opens `/dashboard/api-connections`
- **THEN** the Resources card includes the Country & territory code resource
- **AND** the Resources card includes the ROP Codes resource
- **AND** the Country & territory code row opens `/dashboard/country-codes`
- **AND** the ROP Codes row opens `/dashboard/rop-codes`

#### Scenario: Admin views Resources rows
- **WHEN** a dataset admin views the Resources card on `/dashboard/api-connections`
- **THEN** the Resources card renders built-in and captured resources as label-only rows
- **AND** the Resources card does not show visible Category, Display text, URL, or Open columns
