# google-sheets-header-selection Specification

## Purpose
Define deterministic, administrator-confirmed Google Sheets header selection, optional bounded multi-row composition, drift-safe parsing, and private preview behavior for service-account imports.

## Requirements

### Requirement: Google Sheets connections recommend a header row from a bounded preview
The system SHALL inspect a bounded beginning of a selected Google Sheet tab and deterministically recommend one header row without treating a report title, instruction row, or numeric guide row as the header.

#### Scenario: Report metadata precedes the real header
- **WHEN** a readable Sheet begins with sparse report titles and instructions, followed by a numeric guide row and then a populated textual header row
- **THEN** the system recommends the populated textual row and previews data beginning after that row

#### Scenario: Clean Sheet starts with headers
- **WHEN** the first non-empty Sheet row has a high-confidence header shape and subsequent rows have a compatible data shape
- **THEN** the system recommends that first non-empty row without requiring a manual correction

#### Scenario: Recommendation is ambiguous
- **WHEN** bounded Sheet values do not produce a high-confidence recommendation
- **THEN** the system labels the result as requiring review and does not silently import an unconfirmed ambiguous structure

### Requirement: Administrators can review and override the header selection
The system SHALL show the recommended one-based Sheet row number, confidence, resulting column labels, and sample data rows and SHALL let a dataset admin select a different previewed row before connecting or refreshing.

#### Scenario: Admin accepts the recommendation
- **WHEN** a dataset admin reviews the recommended row and confirms the connection
- **THEN** the system persists and uses that row as the connection's header

#### Scenario: Admin selects a different row
- **WHEN** a dataset admin selects another previewed row and confirms it
- **THEN** the system recomputes the preview, persists a manual selection, excludes all rows through the selected header from data, and uses that selection instead of the automatic recommendation

#### Scenario: Admin edits an existing connection
- **WHEN** a dataset admin opens an active Google Sheets connection and changes its header selection
- **THEN** the system revalidates the selected row against the live Sheet, shows the resulting labels and data preview, and persists the change only after explicit confirmation

#### Scenario: Non-admin attempts to preview or change headers
- **WHEN** an unauthenticated or non-admin user calls a header preview or update operation
- **THEN** the system rejects the request without exposing Sheet values or modifying connection configuration

### Requirement: Administrators can explicitly compose multi-row headers
The system SHALL provide an advanced option to combine one-to-three consecutive Sheet rows into column labels while keeping single-row selection as the default.

#### Scenario: User-reference row should not be combined
- **WHEN** two title-like rows are present but the administrator selects only the row containing import column titles
- **THEN** the system ignores the user-reference row and uses only the selected row

#### Scenario: Genuine two-row header is combined
- **WHEN** an administrator selects two consecutive rows as a header range
- **THEN** the system composes each column top-to-bottom, removes blank, repeated, and numeric-guide fragments, expands bounded merged group labels when metadata is available, and previews the exact resulting labels

#### Scenario: Header range is invalid
- **WHEN** an administrator submits non-consecutive rows, more than three rows, an out-of-preview row, or a range with no usable labels
- **THEN** the system rejects the selection and does not create, update, or refresh the connection

### Requirement: Confirmed header selections are stable and drift-safe
The system SHALL persist a normalized fingerprint for a confirmed header selection and MUST NOT silently replace a manual selection with a later automatic recommendation.

#### Scenario: Confirmed header remains unchanged
- **WHEN** a run recomposes the configured header and its fingerprint matches
- **THEN** the system parses data using the confirmed selection

#### Scenario: Unchanged header moves
- **WHEN** rows are inserted or removed above a confirmed header and exactly one bounded row or row range has the same fingerprint
- **THEN** the system safely relocates the header for that run and excludes rows through its new location

#### Scenario: Header changes materially
- **WHEN** the configured header fingerprint no longer matches and no unique exact match exists
- **THEN** the system fails before archiving output or mutating the target dataset and instructs the administrator to review the header selection

#### Scenario: Legacy connection has no selection
- **WHEN** an existing Google Sheets connection without header configuration runs against a high-confidence structure
- **THEN** the system uses the deterministic recommendation for compatibility and exposes the selection for administrator confirmation

#### Scenario: Legacy connection is ambiguous
- **WHEN** an existing Google Sheets connection without header configuration has no high-confidence recommendation
- **THEN** the system fails before dataset mutation and instructs the administrator to review and save a selection

### Requirement: Header previews and saved configuration protect private Sheet data
The system SHALL fetch header previews only through fixed Google Sheets API endpoints with the existing read-only service account and SHALL persist configuration metadata without persisting preview data rows.

#### Scenario: Header preview succeeds
- **WHEN** a dataset admin requests a header preview for a selected readable tab
- **THEN** the system returns bounded candidate rows, composed labels, and bounded sample data without exposing service-account credentials

#### Scenario: Header selection is saved
- **WHEN** a dataset admin confirms a selection
- **THEN** the connection stores row/range intent, normalized labels, fingerprint, confidence, and confirmation metadata but does not store sample data in provider configuration

#### Scenario: Sheet is no longer readable
- **WHEN** preview or confirmation cannot read the selected stable tab with the service account
- **THEN** the system returns the existing actionable access or tab-missing failure and does not modify the connection or target dataset
