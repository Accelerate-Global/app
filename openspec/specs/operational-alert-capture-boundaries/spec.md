# operational-alert-capture-boundaries Specification

## Purpose

Define the trusted server-side connection, pipeline, authentication, and upload
failure boundaries that submit privacy-safe events to bounded operational email
delivery.

## Requirements

### Requirement: Actionable connection failures produce operational alerts
The system SHALL enqueue a sanitized high-severity operational alert after an API connection test, access check, source pull, or import run reaches a persisted failed state.

#### Scenario: Connection test fails
- **WHEN** a connection test run persists a failed state and redacted failure log
- **THEN** the system enqueues one alert identified by that run and failure category
- **AND** the existing failed run response remains unchanged if alert capture fails

#### Scenario: Durable source pull stops making progress
- **WHEN** reconciliation closes a stale queued or running source pull as failed
- **THEN** the system enqueues a sanitized source-pull alert for the closed run

#### Scenario: Administrator cancels a run
- **WHEN** an administrator cancels a connection run
- **THEN** the system records the existing cancellation outcome without enqueueing an operational alert

### Requirement: Terminal dataset pipeline failures produce operational alerts
The system SHALL enqueue a sanitized high-severity operational alert when a dataset pipeline attempt transitions the overall run to terminal failure.

#### Scenario: Pipeline attempt remains retryable
- **WHEN** a failed pipeline attempt is scheduled for another retry and the overall run is not terminally failed
- **THEN** the system preserves retry behavior without enqueueing a failure alert

#### Scenario: Pipeline run becomes terminally failed
- **WHEN** the database failure transition reports the overall pipeline run as failed
- **THEN** the system enqueues one alert with the safe flow, stage, effect, and normalized error-code categories
- **AND** it does not include input rows, artifacts, or raw exception details

### Requirement: Repeated sign-in failures are counted privately
The system SHALL count invalid password sign-ins through a same-origin server boundary and SHALL alert only after five failures for the same keyed subject within 15 minutes.

#### Scenario: One password attempt is invalid
- **WHEN** a sign-in attempt returns invalid credentials fewer than five times in the active window
- **THEN** the user receives a generic authentication error
- **AND** no operational email is enqueued

#### Scenario: Fifth password attempt is invalid
- **WHEN** the same keyed subject reaches five invalid sign-in attempts within 15 minutes
- **THEN** the system enqueues one sanitized high-severity repeated-failure alert
- **AND** the alert and counter contain no email address, password, raw IP address, or provider payload

#### Scenario: Sign-in succeeds after failures
- **WHEN** the subject successfully signs in
- **THEN** the system establishes the existing Supabase session
- **AND** clears that subject's active failure counter without changing the successful response if cleanup fails

#### Scenario: Authentication provider fails
- **WHEN** sign-in fails because of a provider, rate-limit, network, or configuration error rather than invalid credentials
- **THEN** the system enqueues a sanitized critical authentication-system alert immediately
- **AND** returns a generic authentication failure without exposing provider details

### Requirement: Dataset upload and import failures produce operational alerts
The system SHALL enqueue sanitized high-severity alerts for server-observed upload authorization, storage transfer, parsing, dataset creation, replacement, and row-persistence failures while excluding ordinary local validation errors.

#### Scenario: Upload authorization fails unexpectedly
- **WHEN** Supabase Storage cannot create an authorized upload after the request passes validation and authorization
- **THEN** the system enqueues an upload-authorization alert
- **AND** preserves the existing safe API error response

#### Scenario: Signed upload or CSV parsing fails in the browser
- **WHEN** an administrator's confirmed upload encounters a signed Storage transfer or parser execution failure
- **THEN** the browser reports only a fixed stage and random operation identifier to an admin-only same-origin capture endpoint
- **AND** the endpoint constructs the alert without accepting filenames, rows, or arbitrary error text

#### Scenario: Dataset persistence fails
- **WHEN** dataset creation, replacement, or row persistence fails after upload confirmation
- **THEN** the responsible server boundary enqueues a sanitized persistence alert
- **AND** existing cleanup and failed-dataset behavior continue unchanged

#### Scenario: Local upload validation fails
- **WHEN** a file has an unsupported type, exceeds the size limit, lacks required classification, or has invalid headers before confirmed transfer begins
- **THEN** the UI shows the existing validation outcome without enqueueing an operational alert

### Requirement: Capture policy is sanitized, deduplicated, and fail-open
The system SHALL construct alerts from a closed set of operational events and SHALL never let capture failure alter the originating operation.

#### Scenario: Failure event contains an exception
- **WHEN** a capture call receives a failure associated with a raw exception or provider object
- **THEN** it derives only approved fixed text and safe categorical codes
- **AND** does not persist or email raw exception content

#### Scenario: Same failure category recurs
- **WHEN** multiple events share a fingerprint within the existing one-hour cooldown
- **THEN** the delivery system suppresses duplicate email according to the existing budget contract

#### Scenario: Outbox is unavailable
- **WHEN** alert enqueueing fails during a connection, pipeline, authentication, or upload operation
- **THEN** normalized logging records the capture failure when available
- **AND** the original operation retains its existing result and state
