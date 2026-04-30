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
The system SHALL preserve API connection security and compatibility controls during async execution while treating saved profile definitions as codebase-managed records outside the web UI.

#### Scenario: Secrets and blocked URLs remain protected
- **WHEN** an async run executes
- **THEN** the system uses stored secret headers, redacts secret values from logs/previews/errors, requires safe HTTPS URLs, blocks disallowed networks, enforces redirect limits, enforces response-size limits, and uses the configured timeout

#### Scenario: Existing run behavior remains compatible
- **WHEN** admins test or import saved API connection profiles through the allowed run endpoints
- **THEN** the system preserves existing profile fields, secret-header behavior, and create-or-replace dataset import semantics

### Requirement: API connection runs support ArcGIS FeatureServer features
The system SHALL allow dataset admins to configure a saved JSON API connection for ArcGIS FeatureServer feature query endpoints and run that connection through the existing admin-only API connection lifecycle.

#### Scenario: Admin saves ArcGIS feature connection
- **WHEN** a dataset admin saves an API connection for a FeatureServer query endpoint with JSON response format and `features` response path
- **THEN** the system accepts the connection profile using the existing JSON response format

#### Scenario: Admin runs paged ArcGIS feature connection
- **WHEN** a dataset admin runs a matching ArcGIS FeatureServer JSON `features` API connection
- **THEN** the system fetches all available pages from the FeatureServer query endpoint and records normal run status, logs, row count, output metadata, and archived downloads

#### Scenario: Non-admin cannot run ArcGIS feature connection
- **WHEN** an unauthenticated user or non-admin user attempts to create, update, or run an ArcGIS features API connection
- **THEN** the system rejects the request using the existing API connection admin authorization behavior

### Requirement: ArcGIS feature rows use IMB-compatible flattening
The system SHALL normalize ArcGIS feature rows by preserving all feature attribute keys as columns and flattening geometry keys into `geometry_*` columns in first-seen order.

#### Scenario: Feature attributes and geometry are flattened
- **WHEN** an ArcGIS FeatureServer response contains features with `attributes` and `geometry`
- **THEN** the normalized rows include every attribute key, include geometry values under `geometry_*` column names, and preserve scalar values as strings for dataset import and CSV download

#### Scenario: Raw ArcGIS output remains inspectable
- **WHEN** an ArcGIS features run succeeds
- **THEN** the archived JSON output includes the raw feature list used for normalization without exposing secret header values

### Requirement: Joshua Project PGIC runs send the stored key as an upstream query parameter
The system SHALL translate the stored `api_key` secret into the Joshua Project upstream query parameter for Joshua Project people-groups runs while preserving existing API connection safety controls and secret redaction.

#### Scenario: Stored key is appended at run time
- **WHEN** a saved Joshua Project PGIC connection with a stored `api_key` secret runs
- **THEN** the upstream request includes `api_key` as a query parameter and does not send that secret as a normal request header

#### Scenario: Secret remains redacted
- **WHEN** a Joshua Project PGIC run completes or fails
- **THEN** run logs, response previews, raw output artifacts, and saved connection URLs do not expose the stored API key

### Requirement: Joshua Project PGIC output matches script-compatible resource flattening
The system SHALL parse Joshua Project people-group JSON responses into import rows that preserve top-level fields and flatten `Resources` into indexed resource columns while retaining the raw resource payload.

#### Scenario: Resources are flattened
- **WHEN** the Joshua Project response includes a people-group record with `Resources`
- **THEN** the parsed rows include `Resource_01_ROL3`, `Resource_01_Category`, `Resource_01_WebText`, `Resource_01_URL`, subsequent indexed resource columns as needed, and `Resources_raw`

#### Scenario: Existing generic parsers remain compatible
- **WHEN** a non-Joshua API connection run parses JSON or CSV
- **THEN** the system uses the existing generic parsing behavior and does not apply Joshua Project resource flattening

### Requirement: Etnopedia runs execute the MediaWiki export flow
The system SHALL run Etnopedia API connections by listing people-group category members, fetching main and talk page revisions in batches, and recording progress through the existing API connection run lifecycle.

#### Scenario: Admin runs an Etnopedia connection
- **WHEN** a dataset admin starts an Etnopedia API connection run
- **THEN** the system fetches `Category:Peoples_by_name`, retrieves main and `Talk:` revisions for each title, records progress logs, and completes with normal run status, row count, output metadata, and archived downloads

#### Scenario: Etnopedia request fails
- **WHEN** an Etnopedia category or revision request fails, returns invalid JSON, or returns an upstream error
- **THEN** the system records a failed API connection run with an error log and does not create or replace an imported dataset

### Requirement: Etnopedia output matches the proven export shape
The system SHALL normalize Etnopedia people-group data into the script-compatible CSV columns and preserve structured records in the JSON output artifact.

#### Scenario: CSV output uses script columns
- **WHEN** an Etnopedia run succeeds
- **THEN** the normalized rows include the script-compatible fields for provenance, main-page attributes, map data, references, body sections, talk-page IDs, and progress indicators

#### Scenario: Structured JSON remains inspectable
- **WHEN** an Etnopedia run succeeds
- **THEN** the archived JSON output includes structured records with `urls`, `provenance`, `main`, and `talk` objects for each people-group title

#### Scenario: Existing generic parsers remain compatible
- **WHEN** a non-Etnopedia API connection run parses JSON or CSV
- **THEN** the system uses the existing generic parsing behavior and does not apply Etnopedia MediaWiki fetching or wikitext parsing

### Requirement: API Connections web dashboard omits saved profile configuration
The system SHALL present the admin API Connections page as an operational dashboard for saved API connection records without exposing saved request configuration or web profile creation controls.

#### Scenario: Admin views saved connection without configuration fields
- **WHEN** a dataset admin opens the API Connections page and saved connections exist
- **THEN** the page shows selectable saved connections and operational run controls without showing URL, method, headers, body, response parsing, import configuration, preset, new, save, delete, or profile editing controls

#### Scenario: Admin views empty saved connection list
- **WHEN** a dataset admin opens the API Connections page and no saved connections exist
- **THEN** the page explains that no API connections are available and does not offer a web control to create one

### Requirement: API connection profile writes are unavailable through web HTTP endpoints
The system SHALL keep API connection profile creation, update, and deletion unavailable through the admin web HTTP API while preserving authorized read, run, history, detail, and download behavior.

#### Scenario: Admin attempts web profile creation
- **WHEN** a dataset admin sends a create request to the admin API connection collection endpoint
- **THEN** the system rejects the request without creating a saved API connection

#### Scenario: Admin attempts web profile update or deletion
- **WHEN** a dataset admin sends an update or delete request to an individual admin API connection endpoint
- **THEN** the system rejects the request without changing or deleting the saved API connection

### Requirement: Repo-owned API connections are available from code
The system SHALL include repo-owned API connection definitions in the admin API Connections list even when matching private database rows have not yet been materialized.

#### Scenario: Admin views built-in connections before first run
- **WHEN** a dataset admin opens the API Connections page and the database has no matching row for a repo-owned API connection
- **THEN** the page shows the repo-owned connection as a selectable saved connection with the existing test and import actions

#### Scenario: Existing materialized connection is not duplicated
- **WHEN** a repo-owned API connection already exists in the private profile table with its deterministic identifier
- **THEN** the API Connections list returns the materialized row once and includes its associated recent runs

### Requirement: Repo-owned API connections materialize before execution
The system SHALL materialize a repo-owned API connection into the existing private profile table before creating a run for that connection.

#### Scenario: Admin starts first run for repo-owned connection
- **WHEN** a dataset admin starts a test or import run for a repo-owned API connection that has not been materialized
- **THEN** the system creates the private profile row using the repo-owned definition and then starts the normal queued run lifecycle

#### Scenario: Non-admin cannot materialize repo-owned connection
- **WHEN** an unauthenticated user or non-admin user attempts to start a run for a repo-owned API connection
- **THEN** the system rejects the request and does not create a private profile row or run record

#### Scenario: Provider secrets are not committed
- **WHEN** a repo-owned API connection requires a provider secret
- **THEN** the system exposes only the required secret header name and does not include a secret value in tracked source, saved connection URLs, logs, previews, or output artifacts

### Requirement: API Connections index lists available connections
The system SHALL present `/dashboard/api-connections` as an admin-only Datasets surface with a simple table of available API connection records.

#### Scenario: Admin browses available connections
- **WHEN** a dataset admin opens `/dashboard/api-connections`
- **THEN** the page shows a `Datasets` heading and a `Connections` table with connection, classification, and last ingestion columns
- **AND** the page does not show search, classification filter, status filter, or index status column controls

#### Scenario: Admin selects a connection
- **WHEN** a dataset admin clicks or keyboard-selects an API connection row
- **THEN** the system navigates to that connection's dedicated dashboard page

### Requirement: API connection detail dashboard supports run operations
The system SHALL provide an admin-only detail page for each API connection that supports existing test and import run operations.

#### Scenario: Admin views a connection detail page
- **WHEN** a dataset admin opens `/dashboard/api-connections/{connectionId}` for a known materialized or repo-owned connection
- **THEN** the page shows the connection name, description, current status, pipeline skeleton, run actions, collapsed Run Detail section, and collapsed Ingestion History section
- **AND** Run Detail appears before Ingestion History

#### Scenario: Unknown connection detail page
- **WHEN** a dataset admin opens `/dashboard/api-connections/{connectionId}` for an unknown connection
- **THEN** the system returns the normal not-found route behavior

#### Scenario: Non-admin cannot view detail page
- **WHEN** an unauthenticated user or non-admin user opens a connection detail page
- **THEN** the system applies the existing API Connections admin redirect behavior

### Requirement: Pipeline stages are visual skeleton only
The system SHALL show pipeline stages for a selected API connection while keeping independent stage execution disabled in v1.

#### Scenario: Admin views pipeline skeleton
- **WHEN** a dataset admin views an API connection detail page
- **THEN** the page shows Configure, Fetch, Normalize, Archive Output, and Import Dataset stages as disabled coming-soon controls

#### Scenario: Admin starts supported v1 work
- **WHEN** a dataset admin starts a run from the detail page
- **THEN** `Run test` uses the existing test run behavior and `Start ingestion` uses the existing import run behavior

### Requirement: Ingestion history uses DataGrid
The system SHALL list each initiated run for a connection as an ingestion row using the existing DataGrid table interface.

#### Scenario: Admin views ingestion history
- **WHEN** a dataset admin expands Ingestion History on a connection detail page
- **THEN** the DataGrid lists runs with initiated time, mode, status, started time, completed time, duration, row count, HTTP status, actor, and artifact actions
- **AND** at most five run rows are visible before the history table scrolls

#### Scenario: Admin selects an ingestion row
- **WHEN** a dataset admin selects an ingestion row
- **THEN** that run becomes the selected run for Run Detail
- **AND** the page does not automatically expand the Run Detail section
- **AND** when the admin expands Run Detail, the page shows that run's logs, error, preview, output downloads, and imported dataset link when available

### Requirement: API connection runs persist referenced resources
The system SHALL persist referenced document resources extracted from successful API connection output rows while preserving run history.

#### Scenario: Successful run publishes resources
- **WHEN** a test or import API connection run succeeds with parsed rows containing `Resource_##_URL` fields
- **THEN** the system stores valid HTTP(S) resources in `private.api_connection_resources` before marking the run successful

#### Scenario: Invalid resources are skipped
- **WHEN** parsed resource fields have blank, invalid, or non-HTTP(S) URLs
- **THEN** the system does not store those resource entries

#### Scenario: Duplicate URLs are collapsed within a run
- **WHEN** one run output contains multiple resources with the same parsed URL after removing the hash
- **THEN** the system stores one resource row for that connection, run, and normalized URL

### Requirement: API Connections index shows captured resources
The system SHALL show a second read-only Resources grid on the admin API Connections index.

#### Scenario: Admin views captured resources
- **WHEN** a dataset admin opens `/dashboard/api-connections`
- **THEN** the page shows the newest 500 persisted resources with category, display text, URL, and Open action columns below the API Connections grid

#### Scenario: No resources exist
- **WHEN** no resources have been captured
- **THEN** the Resources grid shows an empty state without offering create, update, or delete controls

### Requirement: API connection run artifacts use isolated JSON storage
The system SHALL archive successful API connection run JSON artifacts in a private Storage bucket dedicated to API connection artifacts, while preserving admin download compatibility for artifacts previously stored in the legacy dataset bucket.

#### Scenario: Successful run archives JSON artifacts in artifact storage
- **WHEN** a saved API connection run succeeds and output artifacts are archived
- **THEN** the system uploads the normalized rows artifact and redacted raw response artifact to the API connection artifact bucket using `application/json` content type

#### Scenario: Admin downloads a legacy output artifact
- **WHEN** a dataset admin downloads a run output whose stored object path exists only in the legacy dataset bucket
- **THEN** the system returns the same JSON or CSV download response as it would for an artifact stored in the dedicated artifact bucket

#### Scenario: Dataset CSV uploads remain isolated
- **WHEN** a dataset admin requests a signed upload for a CSV dataset file
- **THEN** the system continues to use the dataset Storage bucket and CSV upload restrictions without allowing direct CSV upload access to the API connection artifact bucket

