# reference-resources Specification

## Purpose
Define how authenticated users discover built-in reference resources that
support dataset review and cleanup work without exposing admin-only API
connection run resources.

## Requirements
### Requirement: Authenticated users can discover built-in reference resources
The system SHALL provide a logged-in Resources page that lists built-in
reference resources without exposing admin-only API connection run resources.

#### Scenario: Signed-in user opens Resources
- **WHEN** a signed-in basic, pro, admin, or super admin user opens
  `/dashboard/resources`
- **THEN** the page shows the built-in reference resource list
- **AND** the list includes the country and territory code resource
- **AND** the country and territory code resource links to
  `/dashboard/country-codes`

#### Scenario: Anonymous user opens Resources
- **WHEN** an anonymous user opens `/dashboard/resources`
- **THEN** the system redirects the user to the sign-in page

#### Scenario: Dashboard links to Resources
- **WHEN** a signed-in user views the dashboard Reference Resources card
- **THEN** the card links to `/dashboard/resources`

#### Scenario: Resources page has UI smoke coverage
- **WHEN** UI smoke route coverage is checked
- **THEN** the Resources page has route-registry entries for signed-in roles
- **AND** the page exposes a matching `data-smoke-page` marker
