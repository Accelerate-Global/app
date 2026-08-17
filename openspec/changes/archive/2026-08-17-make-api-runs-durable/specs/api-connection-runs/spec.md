## ADDED Requirements

### Requirement: Joshua Project runs execute durably in bounded steps
The system SHALL execute Joshua Project PGIC runs as retry-safe bounded steps that can resume after an invocation ends without repeating published output or exposing connector secrets.

#### Scenario: Invocation ends between pages
- **WHEN** a Joshua Project run loses its execution environment after a completed page checkpoint
- **THEN** execution resumes from durable state without refetching or republishing an already accepted page with different contents
- **AND** the run eventually reaches a terminal status

#### Scenario: Step retries
- **WHEN** a transient upstream, storage, or execution failure causes a page step to retry
- **THEN** deterministic chunk paths and checksums prevent duplicate or conflicting accepted output
- **AND** the stored API key remains absent from workflow inputs, progress, logs, and artifacts

### Requirement: Joshua Project output uses bounded private chunks
The system SHALL persist Joshua Project raw response and normalized rows as ordered bounded chunks with versioned manifests while preserving existing authorized JSON and CSV download behavior.

#### Scenario: Large output completes
- **WHEN** a Joshua Project response exceeds the safe size for one in-memory or standard-upload artifact
- **THEN** the system stores ordered page-sized private chunks and publishes a manifest only after all required chunks are verified
- **AND** no partial manifest, dataset, resource set, or successful output is published

#### Scenario: Admin downloads chunked output
- **WHEN** a dataset administrator downloads JSON or CSV output for a successful chunked run
- **THEN** the system streams chunks in source order using the existing content type, encoding, CSV safety, and authorization behavior

#### Scenario: Admin downloads legacy output
- **WHEN** a dataset administrator downloads an output created before chunked manifests were introduced
- **THEN** the system preserves the existing single-artifact download behavior

### Requirement: Dataset administrators can stop active API connection runs
The system SHALL allow a dataset administrator to request cancellation of a queued or running API connection run and SHALL prevent a cancellation request from racing into successful publication.

#### Scenario: Admin stops a queued run
- **WHEN** a dataset administrator stops a queued run before source work begins
- **THEN** the run becomes `cancelled`, records a completion timestamp and cancellation log, and performs no upstream request or publication

#### Scenario: Admin stops a running Joshua run
- **WHEN** a dataset administrator stops a running Joshua Project run
- **THEN** the UI presents a stopping state immediately
- **AND** execution stops before the next bounded page or final publication
- **AND** the run becomes `cancelled` without exposing partial output

#### Scenario: Unauthorized stop attempt
- **WHEN** an unauthenticated or non-admin user attempts to stop a run
- **THEN** the system rejects the request without changing run or workflow state

### Requirement: Active API connection runs expose truthful liveness
The system SHALL persist progress and heartbeat metadata for durable API connection work and SHALL reconcile definitively abandoned or deadline-exceeded runs to a terminal state.

#### Scenario: Durable run reports progress
- **WHEN** a Joshua Project page checkpoint completes
- **THEN** run detail reports the current stage, completed pages, cumulative records and bytes, and a fresh heartbeat without exposing the API key

#### Scenario: Active run heartbeat is stale
- **WHEN** an active run has no fresh heartbeat within the configured liveness threshold
- **THEN** the UI identifies the run as stalled rather than indefinitely presenting normal progress
- **AND** the watchdog reconciles an abandoned run to `failed` or a cancellation-requested run to `cancelled`

#### Scenario: Overall deadline expires
- **WHEN** a durable run exceeds its configured overall business deadline
- **THEN** no further page or publication step begins
- **AND** the run reaches a terminal status with a normalized redacted explanation

## MODIFIED Requirements

### Requirement: Joshua Project PGIC runs retrieve complete output through bounded pagination
The system SHALL retrieve Joshua Project people-group records through ordered, durable, bounded upstream pages while preserving the existing complete output, resource flattening, secret handling, and all-or-nothing run lifecycle.

#### Scenario: Complete paginated run succeeds
- **WHEN** a dataset administrator starts a Joshua Project PGIC test or import run and the upstream service returns one or more valid pages followed by a short terminal page
- **THEN** the system requests pages in ascending page order with bounded page sizes
- **AND** checkpoints accepted pages so execution can resume after an invocation boundary
- **AND** completes the run with every returned record in upstream page order
- **AND** preserves profile text, resource fields, normalized rows, and downloadable raw output

#### Scenario: Page progress is observable
- **WHEN** a Joshua Project PGIC run retrieves and accepts an upstream page
- **THEN** persisted run progress records that page's row count, cumulative row and byte counts, and a fresh heartbeat without exposing the stored API key

#### Scenario: Upstream page fails
- **WHEN** any Joshua Project page times out, returns a non-success status, returns an invalid response shape, repeats a non-empty prior page, conflicts with a retained page checksum, or exceeds a configured page, byte, aggregate, or deadline bound
- **THEN** the step applies its bounded retry policy or the run fails with a normalized error
- **AND** does not publish partial output, resources, formed candidates, or dataset changes

#### Scenario: Other HTTP providers retain existing limits
- **WHEN** a non-Joshua generic HTTP, ArcGIS, or Etnopedia connection runs
- **THEN** the system preserves that provider's existing request, response-size, parsing, pagination, and execution behavior
