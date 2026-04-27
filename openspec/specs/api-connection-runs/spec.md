# api-connection-runs Specification

## Purpose
Define the admin-only lifecycle for running saved API connection profiles asynchronously, persisting run progress, archiving normalized outputs, and exposing JSON/CSV downloads while preserving existing API connection safety and dataset import behavior.

## Requirements
### Requirement: Admin starts asynchronous API connection runs
The system SHALL allow dataset admins to start a saved API connection run and receive a queued run record without waiting for the upstream request and output processing to finish.

#### Scenario: Admin starts a run
- **WHEN** a dataset admin starts a saved API connection run from the UI or admin API
- **THEN** the system returns a queued run with a run identifier and schedules execution in the background

#### Scenario: Non-admin cannot start a run
- **WHEN** an unauthenticated user or non-admin user attempts to start a saved API connection run
- **THEN** the system rejects the request and does not create a run

### Requirement: API connection runs expose persisted progress
The system SHALL persist lifecycle status and timestamped log messages for each API connection run so the admin UI can show progress while execution is queued or running.

#### Scenario: Run progresses through lifecycle
- **WHEN** a queued run begins executing and then completes successfully
- **THEN** the system records running and success states with lifecycle timestamps and progress logs

#### Scenario: Run fails
- **WHEN** an upstream request, parsing step, output persistence step, or dataset import step fails
- **THEN** the system records a failed run with a redacted error message and a failure log

### Requirement: API connection runs preserve downloadable outputs
The system SHALL persist successful run outputs as archived artifacts containing normalized rows for CSV export and redacted raw response data for JSON export.

#### Scenario: Successful test run output
- **WHEN** a saved API connection test run succeeds
- **THEN** the system archives parsed rows, columns, a redacted raw response artifact, and output metadata without creating or replacing a dataset

#### Scenario: Successful import run output
- **WHEN** a saved API connection import run succeeds
- **THEN** the system archives parsed output artifacts and also creates or replaces the configured dataset using the existing import settings

### Requirement: Admin can inspect run history and outputs
The system SHALL allow dataset admins to list recent runs for a connection, inspect one run with logs and output metadata, and view the latest output in the API Connections page.

#### Scenario: Admin views latest output
- **WHEN** a dataset admin opens or polls the API Connections page for a selected connection
- **THEN** the UI shows the latest run status, logs, row count, preview, imported dataset link when available, and download actions when output artifacts exist

#### Scenario: Admin browses archived outputs
- **WHEN** a dataset admin views the selected connection run history
- **THEN** the UI lists archived runs newest first with status, timing, row count, and available output downloads

### Requirement: Admin can download outputs as JSON or CSV
The system SHALL allow dataset admins to download a run output as JSON or CSV while preserving the configured encoding behavior.

#### Scenario: JSON download
- **WHEN** a dataset admin downloads a run output as JSON
- **THEN** the response uses `application/json; charset=utf-8` and contains the redacted raw response artifact without a UTF-8 BOM

#### Scenario: CSV download
- **WHEN** a dataset admin downloads a run output as CSV
- **THEN** the response uses `text/csv; charset=utf-8`, includes a UTF-8 BOM, uses CRLF line endings, and serializes the normalized rows and columns

#### Scenario: Non-admin cannot download output
- **WHEN** an unauthenticated user or non-admin user attempts to download an API connection run output
- **THEN** the system rejects the request and does not expose the artifact

### Requirement: Existing API connection safety controls remain enforced
The system SHALL preserve existing API connection security and compatibility controls during async execution.

#### Scenario: Secrets and blocked URLs remain protected
- **WHEN** an async run executes
- **THEN** the system uses stored secret headers, redacts secret values from logs/previews/errors, requires safe HTTPS URLs, blocks disallowed networks, enforces redirect limits, enforces response-size limits, and uses the configured timeout

#### Scenario: Existing profile behavior remains compatible
- **WHEN** admins create, update, delete, test, or import saved API connection profiles
- **THEN** the system preserves existing profile fields, secret-header behavior, and create-or-replace dataset import semantics
