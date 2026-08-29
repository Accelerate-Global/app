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

### Requirement: Dataset filter context precedes the controls that shape it

The system SHALL combine the Current filtered table summary, its available actions, and the Filters panel into one cohesive soft-surface component on desktop dataset-detail layouts. The combined component SHALL fit the established filter-column width without horizontal overflow, while the same single summary/action control instance SHALL remain available above dataset content on narrower layouts where Filters open in a slide-out. The Table data surface SHALL use the same semantic soft background treatment and SHALL align its default desktop viewport height with the combined left-column component.

#### Scenario: User explores a dataset on desktop

- **WHEN** an authenticated user opens dataset detail at the desktop filter-sidebar breakpoint
- **THEN** Current filtered table and Filters appear within one left-column component
- **AND** the Table or Map content remains in the wider right column
- **AND** the default Table viewport aligns with the combined left-column component height

#### Scenario: Filtered-table actions fit the sidebar

- **WHEN** the user's role exposes download, save, or assign actions in the desktop left column
- **THEN** every available action remains readable and operable without horizontal overflow
- **AND** omitted role-specific actions do not leave unusable layout gaps

#### Scenario: Table uses the surrounding component surface

- **WHEN** the user views dataset rows in Table mode in light or dark appearance
- **THEN** the table header, rows, pinned cells, and loading or empty surface use semantic soft colors consistent with the Current filtered table and Filters component
- **AND** borders, hover states, selection states, and readable text contrast remain visible

#### Scenario: User explores a dataset on a narrow viewport

- **WHEN** the desktop Filters panel is replaced by its slide-out trigger
- **THEN** Current filtered table remains visible above the Table or Map content
- **AND** its Filters trigger and permitted table actions remain keyboard-operable without duplicating the control group

### Requirement: Dataset-detail actions reflect their operating scope

The system SHALL separate dataset-level administrator actions, filtered-view actions, and Table/Map view controls on dataset detail. Administrators SHALL receive one Dataset actions menu containing Edit dataset and Partner exports. The filtered-view creation action SHALL remain in Current filtered table and use the label Create dataset from current view. Table and Map SHALL remain a separate view switch.

#### Scenario: Administrator opens dataset actions

- **WHEN** an authenticated `admin` or `super_admin` opens dataset detail
- **THEN** one Dataset actions menu is visible in the dataset toolbar
- **AND** the menu provides Edit dataset and Partner exports
- **AND** Table and Map remain in a separate grouped control

#### Scenario: Non-admin opens dataset detail

- **WHEN** an authenticated `pro` or `basic` user opens dataset detail
- **THEN** the Dataset actions menu is not rendered
- **AND** Table and Map remain available according to the existing dataset-view behavior

#### Scenario: Administrator creates a dataset from filtered results

- **WHEN** an administrator has at least one eligible destination dataset and views a non-temporary filtered table
- **THEN** Current filtered table exposes Create dataset from current view
- **AND** activating it opens the existing derived-view creation flow with the current filters and record count
- **AND** the action is not duplicated in Dataset actions

#### Scenario: Administrator enters dataset configuration

- **WHEN** an administrator selects Edit dataset from Dataset actions
- **THEN** the application opens the existing administrator-only edit page for the current dataset
- **AND** replacement, version history, visibility, field, tag, and destructive controls remain on that page
