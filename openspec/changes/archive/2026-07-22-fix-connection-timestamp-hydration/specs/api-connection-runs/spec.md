## MODIFIED Requirements

### Requirement: Admin can inspect run history and outputs
The system SHALL allow dataset admins to list recent runs for a connection, inspect one run with logs and output metadata, and view the latest output in the API Connections page. Connection and run timestamps SHALL render in one explicitly labeled timezone with identical text during server rendering and browser hydration.

#### Scenario: Admin views latest output
- **WHEN** a dataset admin opens or polls the API Connections page for a selected connection
- **THEN** the UI shows the latest run status, logs, row count, preview, imported dataset link when available, and download actions when output artifacts exist
- **AND** displayed timestamps identify their timezone

#### Scenario: Admin browses archived outputs
- **WHEN** a dataset admin views the selected connection run history
- **THEN** the UI lists archived runs newest first with status, timing, row count, and available output downloads
- **AND** displayed timestamps identify their timezone

#### Scenario: Connection timestamps hydrate deterministically
- **WHEN** a server-rendered connection list or run-detail view hydrates in a browser configured for a different local timezone
- **THEN** the displayed timestamp text remains identical and does not cause a React text hydration mismatch
