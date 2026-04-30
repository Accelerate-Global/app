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

### Requirement: Admin can start with the IMB People Groups preset
The system SHALL provide an admin UI preset for the public IMB People Groups ArcGIS layer so admins can create the saved connection without manually translating the working script into app fields.

#### Scenario: Admin applies IMB preset
- **WHEN** a dataset admin applies the `IMB (People Groups)` preset on the API Connections page
- **THEN** the connection form is populated with the public IMB FeatureServer query endpoint, JSON `features` response path, create-dataset import settings, `imb-people-groups.csv`, and PGIC classification

### Requirement: Admin can create a Joshua Project PGIC connection from a preset
The system SHALL provide an admin-only Joshua Project (PGIC) setup option that pre-fills the saved API connection fields needed to fetch Joshua Project people-group data while requiring the API key to be entered as a stored secret.

#### Scenario: Admin applies the preset
- **WHEN** a dataset admin chooses the Joshua Project (PGIC) setup option on the API Connections page
- **THEN** the form uses `GET`, targets the Joshua Project people-groups endpoint with `include_profile_text=Y`, `include_resources=Y`, `page=1`, and `limit=100000`, sets JSON response handling, sets PGIC dataset classification, and includes a secret `api_key` field without a committed value

#### Scenario: Preset key is not exposed in tracked code
- **WHEN** the Joshua Project preset is rendered in the browser
- **THEN** the provided API key is not present in client source, saved connection URLs, or preset defaults, and the admin must save it through the existing secret field flow

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

### Requirement: Admin can create an Etnopedia connection from a preset
The system SHALL provide an admin-only Etnopedia setup option that pre-fills the saved API connection fields needed to fetch Etnopedia people-group data.

#### Scenario: Admin applies the preset
- **WHEN** a dataset admin chooses the `Etnopedia` setup option on the API Connections page
- **THEN** the form uses `GET`, targets `https://en.etnopedia.org/api.php`, sets JSON response handling, sets PGIC dataset classification, and uses an Etnopedia dataset filename

#### Scenario: Existing admin authorization remains unchanged
- **WHEN** an unauthenticated user or non-admin user attempts to create, update, or run the saved Etnopedia connection
- **THEN** the system rejects the request using the existing API connection admin authorization behavior

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
