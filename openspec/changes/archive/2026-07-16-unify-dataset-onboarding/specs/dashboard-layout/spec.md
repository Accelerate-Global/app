## ADDED Requirements

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
