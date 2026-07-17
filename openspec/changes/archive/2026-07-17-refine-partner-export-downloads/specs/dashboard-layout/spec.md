## MODIFIED Requirements

### Requirement: Dashboard navigation provides immediate transition feedback
The system SHALL keep the authenticated dashboard frame stable and provide
immediate visual feedback while dashboard route content loads, SHALL label the
administrator dataset-creation menu entry `Add Dataset`, and SHALL label the
administrator field-source menu entry `Field Sources`.

#### Scenario: User navigates from the account menu
- **WHEN** a signed-in user selects a dashboard page from the account menu
- **THEN** navigation uses in-app link behavior for that destination
- **AND** the shared dashboard header remains stable during the route transition
- **AND** route content shows loading feedback until the destination page is ready

#### Scenario: Dashboard page content becomes ready
- **WHEN** the destination dashboard page finishes loading its required content
- **THEN** the rendered page exposes its route-specific page-ready smoke marker
- **AND** existing page permissions, redirects, and not-found behavior remain unchanged

#### Scenario: Administrator views the dataset-creation menu entry
- **WHEN** an administrator opens the account menu
- **THEN** the existing `/dashboard/upload` navigation item is labeled `Add Dataset`
- **AND** the item remains hidden from non-admin users

#### Scenario: Administrator views the field-source menu entry
- **WHEN** an administrator opens the account menu
- **THEN** the existing `/dashboard/field-sources` navigation item is labeled `Field Sources`
- **AND** the item remains hidden from non-admin users
