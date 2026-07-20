## MODIFIED Requirements

### Requirement: Dashboard navigation provides immediate transition feedback
The system SHALL keep the authenticated dashboard frame stable and provide
immediate visual feedback while dashboard route content loads, SHALL label the
administrator dataset-creation menu entry `Add Dataset`, and SHALL omit retired
Field Sources and Analytics destinations from the account menu.

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

#### Scenario: Administrator views simplified admin navigation
- **WHEN** an administrator opens the account menu
- **THEN** the menu does not include Field Sources or Analytics destinations
- **AND** the supported Definitions and User Management destinations remain available

#### Scenario: User opens a retired admin route
- **WHEN** a signed-in user opens `/dashboard/field-sources` or `/dashboard/analytics`
- **THEN** Field Sources redirects to `/dashboard/field-definitions`
- **AND** Analytics redirects to `/dashboard/user-management`
