# dataset-onboarding Specification

## Purpose
Define the guided administrator workflow for adding Google Sheets and CSV datasets while reviewing structure, identity, access, import outcomes, and recovery before reaching the created datasets.

## Requirements

### Requirement: Administrators add supported datasets through one guided workflow
The system SHALL provide one administrator-only Add dataset workflow that supports Google Sheets and CSV sources and presents source selection, source preparation, structure review, dataset details, review, import, and completion as ordered stages.

#### Scenario: Administrator starts onboarding
- **WHEN** an authenticated administrator opens `/dashboard/datasets/new`
- **THEN** the system shows Google Sheet and CSV file source choices
- **AND** the system does not show generic API profile creation

#### Scenario: Non-admin opens onboarding
- **WHEN** an unauthenticated, `pro`, or `basic` user opens the Add dataset route
- **THEN** the system applies the existing administrator dataset-surface redirect behavior

#### Scenario: Administrator navigates backward
- **WHEN** an administrator returns to an earlier onboarding stage before import begins
- **THEN** the system preserves valid source and dataset input that is not invalidated by the change

### Requirement: Google Sheets onboarding progressively reviews source structure
The system SHALL check service-account access, allow selection of readable tabs, detect each selected tab's headers, summarize high-confidence results, and require visible review for ambiguous results while preserving manual one-to-three-row header selection.

#### Scenario: High-confidence header is detected
- **WHEN** a selected Sheet tab has a high-confidence automatic header selection
- **THEN** the structure stage shows a compact summary containing the selected row range, confidence, and resulting column count
- **AND** the administrator can expand the full header editor

#### Scenario: Ambiguous header is detected
- **WHEN** a selected Sheet tab does not have a high-confidence automatic header selection
- **THEN** the structure stage expands or prominently requires header review before continuing

#### Scenario: Administrator combines header rows
- **WHEN** an administrator selects two or three consecutive header rows for a Sheet tab
- **THEN** the review summary and import use the combined resulting columns

#### Scenario: Sheet URL changes after access confirmation
- **WHEN** the administrator changes the Google Sheet URL after access or header results were loaded
- **THEN** the system clears stale spreadsheet, tab, header, and per-tab name state before another access check

### Requirement: Onboarding reviews dataset identity and access before creation
The system SHALL let an administrator review and edit every new dataset name and SHALL show classification and workspace access choices before any connection, dataset record, or CSV object is created.

#### Scenario: Administrator reviews one dataset
- **WHEN** one Sheet tab or CSV source reaches dataset details
- **THEN** the system shows an editable source-derived name, PGAC/PGIC classification, and explicit workspace-visible or administrators-only access choices

#### Scenario: Administrator reviews multiple Sheet tabs
- **WHEN** multiple Sheet tabs are selected
- **THEN** the system shows one editable unique dataset name per tab
- **AND** classification and access apply to all selected tabs

#### Scenario: Administrator chooses private access
- **WHEN** the administrator chooses administrators-only access
- **THEN** the system previews the canonical red `Private` tag
- **AND** the system explains that imported dataset access does not change the source Sheet sharing required by the service account

### Requirement: Google Sheets onboarding connects and imports with recoverable per-tab outcomes
The system SHALL create the reviewed Sheet-tab connections once, start one first import for each created connection, and present independent progress and recovery outcomes without reconnecting successful sources.

#### Scenario: All selected tabs import successfully
- **WHEN** connection creation succeeds and every first import succeeds
- **THEN** the completion stage shows every dataset as ready with an Open dataset action

#### Scenario: One selected tab import fails
- **WHEN** multiple connections are created and one first import fails while another succeeds
- **THEN** the completion stage preserves the successful dataset action and shows a redacted actionable failure for the failed item
- **AND** retrying the failed item starts another import for its existing connection without resubmitting connection creation

#### Scenario: Connection creation fails atomically
- **WHEN** the selected tabs include an existing active connection or another connect validation error
- **THEN** the workflow creates no new connections for the selection and returns the administrator to actionable source review

### Requirement: CSV onboarding validates locally and writes only after confirmation
The system SHALL validate a selected CSV's type, size, and first-row columns locally, review its name/classification/access, and defer upload and dataset creation until the administrator confirms the final review.

#### Scenario: Administrator selects a valid CSV
- **WHEN** an administrator chooses a valid CSV within the size limit
- **THEN** the system shows its detected columns and dataset details without uploading the object

#### Scenario: Administrator confirms CSV import
- **WHEN** the administrator confirms a valid reviewed CSV
- **THEN** the system performs the existing authorized upload, dataset creation, row persistence, completion, and failure-cleanup behavior using the reviewed name, classification, and access

#### Scenario: Administrator replaces an existing dataset
- **WHEN** an administrator opens `/dashboard/upload?replace={datasetId}`
- **THEN** the system preserves the existing replacement and version-history workflow rather than entering new-dataset onboarding

### Requirement: Onboarding is accessible, responsive, and privacy-safe
The system SHALL expose the current stage accessibly, move focus to stage content
after navigation, announce asynchronous progress, and remain completable at phone
widths without emitting custom product analytics.

#### Scenario: Keyboard user advances through stages
- **WHEN** a keyboard user advances or returns within onboarding
- **THEN** the current ordered step uses `aria-current="step"`
- **AND** focus moves to the new stage heading without losing valid form state

#### Scenario: Import progress changes
- **WHEN** a connection or upload changes status
- **THEN** the system announces the status through a polite live region and preserves visible status text

#### Scenario: Administrator completes onboarding
- **WHEN** an administrator advances through or completes dataset onboarding
- **THEN** no custom product analytics event is emitted
- **AND** the reviewed connection or dataset workflow otherwise remains unchanged
