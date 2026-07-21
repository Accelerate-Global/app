## MODIFIED Requirements

### Requirement: Authenticated users can discover built-in reference resources
The system SHALL provide logged-in users with a persistent catalog of built-in
reference resources without exposing admin-only candidates, validation findings,
audit details, API connection run resources, or internal active-version numbers.

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
- **AND** each card shows its freshness as `Updated` followed by the source timestamp
- **AND** each card omits its internal active version number
- **AND** the card does not show a separate Open resource action

#### Scenario: Resources page includes ROP codes
- **WHEN** a signed-in user views the Resources page after bootstrap
- **THEN** the built-in resource list includes the ROP Codes resource
- **AND** the ROP Codes card links to `/dashboard/rop-codes`
- **AND** the card is a direct link without a separate Open resource action

#### Scenario: Resource catalog has an active usable version
- **WHEN** any signed-in user, including a dataset admin, views a resource card
  with an active version
- **THEN** the card does not show valid candidate, invalid build, interrupted
  build, or other inactive-candidate labels
- **AND** administrators can inspect candidate state and validation findings on
  the resource detail lifecycle surface

#### Scenario: Resource detail shows freshness
- **WHEN** a signed-in user views an active reference resource detail surface
- **THEN** visible lifecycle freshness uses the word `Updated`
- **AND** the surface does not show the active version number
