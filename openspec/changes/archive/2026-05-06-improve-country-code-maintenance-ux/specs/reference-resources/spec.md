## MODIFIED Requirements

### Requirement: Authenticated users can discover built-in reference resources
The system SHALL provide logged-in users with discoverable built-in reference
resources without exposing admin-only API connection run resources.

#### Scenario: Account menu links to Resources
- **WHEN** a signed-in basic, pro, admin, or super admin user opens the account
  menu
- **THEN** the menu includes a Resources item
- **AND** the Resources item links to `/dashboard/resources`
