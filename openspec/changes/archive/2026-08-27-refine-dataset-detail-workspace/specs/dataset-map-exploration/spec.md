## MODIFIED Requirements

### Requirement: Dataset detail provides a map alternative

The system SHALL provide authenticated users a `Table` / `Map` view choice on the existing dataset-detail page, SHALL keep `Table` as the initial view, and SHALL place that view choice in the dataset toolbar beside the administrator-only Partner exports action when that action is available.

#### Scenario: User opens an accessible dataset

- **WHEN** an authenticated user opens a dataset they are authorized to read
- **THEN** the dataset detail renders in Table mode
- **AND** the user can switch to Map mode without navigating to another route

#### Scenario: Administrator views dataset toolbar actions

- **WHEN** an `admin` or `super_admin` user opens an accessible dataset
- **THEN** the Table and Map controls appear beside the Partner exports button in the dataset toolbar
- **AND** each control retains its existing accessible name and pressed state

#### Scenario: Non-admin views dataset toolbar actions

- **WHEN** a `pro` or `basic` user opens an accessible dataset
- **THEN** the Table and Map controls remain available in the dataset toolbar
- **AND** the Partner exports button is not rendered

#### Scenario: User returns from Map mode

- **WHEN** the user switches from Map mode back to Table mode
- **THEN** the existing table, sorting, filters, downloads, and dataset actions remain available

#### Scenario: User opens a saved table or derived view

- **WHEN** the dataset-detail page is initialized from an accessible saved table or derived view
- **THEN** Map mode uses the same initialized filters and backing rows as Table mode
- **AND** the selected Table/Map mode is not added to the saved-filter state
