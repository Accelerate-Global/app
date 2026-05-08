# reference-resources Specification

## Purpose
Define how authenticated users discover built-in reference resources that
support dataset review and cleanup work without exposing admin-only API
connection run resources.
## Requirements
### Requirement: Authenticated users can discover built-in reference resources
The system SHALL provide logged-in users with discoverable built-in reference
resources without exposing admin-only API connection run resources.

#### Scenario: Account menu links to Resources
- **WHEN** a signed-in basic, pro, admin, or super admin user opens the account
  menu
- **THEN** the menu includes a Resources item
- **AND** the Resources item links to `/dashboard/resources`

#### Scenario: Dashboard omits reference resources card
- **WHEN** a signed-in user views the dashboard
- **THEN** the dashboard does not show a Reference Resources card
- **AND** the dashboard does not show a Browse reference resources link

#### Scenario: Dashboard hides empty saved datasets
- **WHEN** a signed-in user views the dashboard without owner-scoped saved
  datasets
- **THEN** the dashboard does not show the Saved Datasets section
- **AND** the dashboard still shows available datasets

#### Scenario: Dashboard shows saved datasets when present
- **WHEN** a signed-in user views the dashboard with one or more owner-scoped
  saved datasets
- **THEN** the dashboard shows the Saved Datasets section
- **AND** the user can open and manage those saved datasets through the existing
  saved-dataset controls

#### Scenario: Resources page cards open built-in resources
- **WHEN** a signed-in user views the Resources page
- **THEN** each built-in resource card is a link to its resource
- **AND** the card does not show a separate Open resource action

#### Scenario: Resources page includes ROP codes
- **WHEN** a signed-in user views the Resources page
- **THEN** the built-in resource list includes the ROP Codes resource
- **AND** the ROP Codes card links to `/dashboard/rop-codes`
- **AND** the card is a direct link without a separate Open resource action

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
