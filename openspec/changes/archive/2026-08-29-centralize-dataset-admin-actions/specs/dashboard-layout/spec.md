## ADDED Requirements

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
