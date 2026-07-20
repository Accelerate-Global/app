# reference-resources Specification

## Purpose
Define how authenticated users discover built-in reference resources that
support dataset review and cleanup work without exposing admin-only API
connection run resources.
## Requirements
### Requirement: Authenticated users can discover built-in reference resources
The system SHALL provide logged-in users with a persistent catalog of built-in
reference resources without exposing admin-only candidates, validation findings,
audit details, or API connection run resources.

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

#### Scenario: Resources page cards open active built-in resources
- **WHEN** a signed-in user views the Resources page
- **THEN** each registered active resource is rendered from the persistent
  catalog as a direct link to its resource route
- **AND** each card shows the active version number and last retrieval time
- **AND** the card does not show a separate Open resource action

#### Scenario: Resources page includes ROP codes
- **WHEN** a signed-in user views the Resources page after bootstrap
- **THEN** the built-in resource list includes the ROP Codes resource
- **AND** the ROP Codes card links to `/dashboard/rop-codes`
- **AND** the card is a direct link without a separate Open resource action

#### Scenario: Admin views resource lifecycle status
- **WHEN** a dataset admin views the Resources page
- **THEN** each catalog card identifies whether a valid candidate, invalid build,
  or interrupted build needs attention
- **AND** a non-admin does not receive those inactive lifecycle details

### Requirement: Admin Datasets Resources card includes built-in reference resources
The system SHALL show dataset admins the active built-in reference resources
from the persistent catalog in the Datasets Resources card.

#### Scenario: Admin views built-in resources on Datasets page
- **WHEN** a dataset admin opens `/dashboard/api-connections`
- **THEN** the Resources card includes the active Country & territory code
  resource
- **AND** the Resources card includes the active ROP Codes resource
- **AND** the Country & territory code row opens `/dashboard/country-codes`
- **AND** the ROP Codes row opens `/dashboard/rop-codes`

#### Scenario: Admin views Resources rows
- **WHEN** a dataset admin views the Resources card on `/dashboard/api-connections`
- **THEN** the Resources card renders catalog-backed built-in and captured
  resources as label-only rows
- **AND** the Resources card does not show visible Category, Display text, URL,
  or Open columns

#### Scenario: Registered catalog metadata changes
- **WHEN** an admin-approved catalog label or route changes
- **THEN** both reference-resource discovery surfaces use the same persisted
  metadata
- **AND** no separate hard-coded card registry must be updated
