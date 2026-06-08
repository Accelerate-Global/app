## ADDED Requirements

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
