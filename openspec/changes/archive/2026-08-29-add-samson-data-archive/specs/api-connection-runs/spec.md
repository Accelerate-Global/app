## MODIFIED Requirements

### Requirement: API connection runs preserve downloadable outputs
The system SHALL preserve successful run outputs as artifacts containing normalized rows for CSV export and redacted raw response data for JSON export, while requiring approved source-specific forming before an IMB import output becomes a workspace dataset. When a source-specific adapter produces normalized rows, the rows artifact SHALL identify the adapter version and checksum while the raw artifact preserves the upstream response used by that adapter. Eligible historical artifacts MAY transition from hot Supabase Storage to a verified cold Samson archive, but their catalog metadata and exact rehydration identity MUST remain available.

#### Scenario: Successful test run output
- **WHEN** a saved API connection test run succeeds
- **THEN** the system archives parsed rows, columns, a redacted raw response artifact, and output metadata without creating or replacing a dataset

#### Scenario: Successful non-IMB import run output
- **WHEN** a saved API connection import run other than IMB succeeds
- **THEN** the system archives parsed output artifacts and also creates or replaces the configured dataset using the existing import settings

#### Scenario: Successful IMB import run output
- **WHEN** the repo-owned IMB connection import run succeeds
- **THEN** the system archives adapter-normalized source rows with adapter metadata and a redacted raw upstream feature artifact with checksums
- **AND** does not create or replace a workspace dataset until an admin explicitly publishes a valid formed candidate

#### Scenario: Eligible historical run becomes cold
- **WHEN** an old run output passes archive, dependency, retention, restore, and operator-approval checks
- **THEN** its payload may leave Supabase Storage
- **AND** the run retains safe catalog metadata, checksums, and an operator rehydration identity

### Requirement: Admin can inspect run history and outputs
The system SHALL allow dataset admins to list recent and cold-cataloged runs for a connection, inspect one run with logs and output metadata, and view the latest output in the API Connections page. Connection and run timestamps SHALL render in one explicitly labeled timezone with identical text during server rendering and browser hydration. The run-detail surface SHALL provide a half-viewport desktop inspection area while keeping its content within the drawer.

#### Scenario: Admin views latest output
- **WHEN** a dataset admin opens or polls the API Connections page for a selected connection
- **THEN** the UI shows the latest run status, logs, row count, preview, imported dataset link when available, and download actions when hot output artifacts exist
- **AND** displayed timestamps identify their timezone

#### Scenario: Admin browses archived outputs
- **WHEN** a dataset admin views the selected connection run history
- **THEN** the UI lists runs newest first with status, timing, row count, hot or cold archive state, and available hot output downloads
- **AND** displayed timestamps identify their timezone

#### Scenario: Admin inspects cold run output
- **WHEN** a dataset admin opens a run whose payload is cold on Samson
- **THEN** the UI shows its safe metadata and explains that operator rehydration is required
- **AND** it does not expose a direct Samson URL or ordinary download action

#### Scenario: Connection timestamps hydrate deterministically
- **WHEN** a server-rendered connection list or run-detail view hydrates in a browser configured for a different local timezone
- **THEN** the displayed timestamp text remains identical and does not cause a React text hydration mismatch

#### Scenario: Admin inspects run detail on a desktop viewport
- **WHEN** a dataset admin opens a run-detail drawer on a desktop-sized page
- **THEN** the drawer occupies half of the viewport width
- **AND** long candidate identifiers, checksums, logs, previews, and archive state remain contained and inspectable without overlapping adjacent fields

#### Scenario: Admin inspects run detail on a narrow viewport
- **WHEN** a dataset admin opens a run-detail drawer on a narrow page
- **THEN** the drawer can use the full available viewport width

### Requirement: Admin can download outputs as JSON or CSV
The system SHALL allow dataset admins to download a hot run output as JSON or CSV while preserving the configured encoding behavior and neutralizing spreadsheet formulas in CSV output. A cold output SHALL require successful operator rehydration before download.

#### Scenario: JSON download
- **WHEN** a dataset admin downloads a hot run output as JSON
- **THEN** the response uses `application/json; charset=utf-8` and contains the redacted raw response artifact without a UTF-8 BOM

#### Scenario: CSV download
- **WHEN** a dataset admin downloads a hot run output as CSV
- **THEN** the response uses `text/csv; charset=utf-8`, includes a UTF-8 BOM, uses CRLF line endings, serializes the normalized rows and columns, and prefixes formula-leading cells so spreadsheet software treats them as text

#### Scenario: Cold output download
- **WHEN** a dataset admin requests an output whose payload remains cold
- **THEN** the system returns a stable rehydration-required outcome without contacting Samson from the request path

#### Scenario: Non-admin cannot download output
- **WHEN** an unauthenticated user or non-admin user attempts to download an API connection run output
- **THEN** the system rejects the request and does not expose the artifact
