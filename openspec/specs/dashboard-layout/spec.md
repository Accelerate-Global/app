# dashboard-layout Specification

## Purpose
Defines the shared authenticated dashboard page width and table header selection
behavior so dashboard surfaces align consistently and table body content remains
selectable.
## Requirements
### Requirement: Dashboard pages use a consistent content width
The system SHALL render authenticated dashboard pages with one shared desktop
content width.

#### Scenario: User navigates between dashboard pages
- **WHEN** a signed-in user opens renderable dashboard pages on desktop
- **THEN** each page uses the same maximum content width
- **AND** the site header aligns to that same maximum width

#### Scenario: User views narrow dashboard content
- **WHEN** a dashboard page contains narrow content such as a profile form or a
  single resource card
- **THEN** the outer page content still uses the shared dashboard width
- **AND** inner controls can keep their own readable width

### Requirement: Table headers are not text-selectable
The system SHALL prevent accidental text selection of table headers while
preserving selectable table body content.

#### Scenario: User drags across a standard table header
- **WHEN** a user drags across a shared table header cell
- **THEN** the header text does not become selected
- **AND** body cell text remains selectable

#### Scenario: User drags across a DataGrid header
- **WHEN** a user drags across a dataset DataGrid header cell
- **THEN** the header text does not become selected
- **AND** existing resize and drag affordances still work

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

### Requirement: Dashboard dataset rows expose key metadata on mobile
The system SHALL render dashboard dataset and saved dataset rows so key row
metadata remains visible on phone-sized viewports without requiring horizontal
scrolling.

#### Scenario: User views datasets on a phone
- **WHEN** a signed-in user opens the dashboard on a phone-sized viewport
- **THEN** each dataset row displays the dataset name and available dataset tags
- **AND** the row count and row actions remain reachable in the same row stack
- **AND** the desktop dashboard dataset grid remains available on wider
  viewports

#### Scenario: User views saved datasets on a phone
- **WHEN** a signed-in user opens a dashboard with saved datasets on a
  phone-sized viewport
- **THEN** each saved dataset row displays its name, source dataset, people
  group count, and row actions in the visible row stack
- **AND** the desktop saved dataset grid remains available on wider viewports

### Requirement: Dataset table population amounts are readable
The system SHALL format population amount cells in rendered dataset tables with
thousands separators while preserving raw dataset values for data operations.

#### Scenario: User views a population column
- **WHEN** a dataset table renders an integer value in a column identified as a
  population column
- **THEN** the visible cell value includes comma thousands separators
- **AND** sorting, filtering, downloads, and API responses continue to use the
  raw dataset value

#### Scenario: User views a numeric non-population column
- **WHEN** a dataset table renders an integer value in a column that is not
  identified as a population column
- **THEN** the visible cell value remains unchanged

### Requirement: Admin dataset surfaces identify restricted datasets with a Private tag

The system SHALL show a canonical red `Private` tag on admin dataset surfaces whenever a dataset is hidden from non-admin users and SHALL treat the tag as system-managed.

#### Scenario: Admin browses restricted datasets

- **WHEN** an authenticated admin views the dashboard dataset list
- **THEN** each restricted dataset row displays a red `Private` tag in its Tags column
- **AND** workspace-visible dataset rows do not display the `Private` tag

#### Scenario: Admin disables workspace visibility while editing

- **WHEN** an authenticated admin turns off the Workspace-visible dataset control
- **THEN** the Tags section immediately displays the red `Private` tag
- **AND** the existing hidden-from-non-admin explanatory message remains visible

#### Scenario: Admin enables workspace visibility while editing

- **WHEN** an authenticated admin turns on the Workspace-visible dataset control
- **THEN** the `Private` tag immediately disappears from the Tags section

#### Scenario: Admin manages ordinary dataset tags

- **WHEN** an authenticated admin creates, reuses, edits, or removes dataset tags
- **THEN** `Private` is unavailable as a freeform or reusable tag
- **AND** the admin cannot recolor, rename, duplicate, or remove the visibility-managed `Private` tag independently of the workspace visibility control

### Requirement: Dashboard provides one administrator dataset-onboarding entry
The system SHALL show administrators one Add dataset action on the dashboard and SHALL route supported new-source creation through the guided onboarding page.

#### Scenario: Administrator adds a dataset from the dashboard
- **WHEN** an administrator selects Add dataset beside the dashboard dataset list
- **THEN** the system navigates to `/dashboard/datasets/new`
- **AND** the administrator chooses Google Sheet or CSV inside that workflow

#### Scenario: Non-admin views the dashboard
- **WHEN** a `pro` or `basic` user views the dashboard dataset list
- **THEN** the Add dataset action is not shown

### Requirement: New upload URLs preserve compatible navigation
The system SHALL route new CSV creation into onboarding while preserving the existing dataset replacement route and version-history behavior.

#### Scenario: Administrator opens legacy new upload URL
- **WHEN** an administrator opens `/dashboard/upload` without a replacement identifier
- **THEN** the system redirects to `/dashboard/datasets/new?source=csv`

#### Scenario: Administrator opens replacement URL
- **WHEN** an administrator opens `/dashboard/upload?replace={datasetId}` for an existing dataset
- **THEN** the existing replacement interface renders and preserves version-history behavior
