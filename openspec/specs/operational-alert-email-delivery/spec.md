# operational-alert-email-delivery Specification

## Purpose
Define durable, deduplicated, free-tier-bounded operational incident email
delivery through Supabase and Resend without a GitHub delivery dependency.

## Requirements

### Requirement: Eligible operational alerts are persisted before delivery
The system SHALL persist a sanitized operational email notification before attempting delivery and SHALL restrict persisted content to approved operational fields.

#### Scenario: High-severity alert is enqueued
- **WHEN** a trusted server or database operation submits a high or critical alert with a unique idempotency key
- **THEN** the system persists a pending notification with its severity, source, fingerprint, title, sanitized summary, occurrence count, and timestamps
- **AND** the notification contains no recipient address, credential, raw provider payload, uploaded data, or arbitrary HTML

#### Scenario: Alert persistence fails
- **WHEN** notification persistence is unavailable during an application operation
- **THEN** the application operation is not failed solely by the notification failure
- **AND** the failure is logged with normalized details when logging remains available

### Requirement: Supabase delivers primary alerts through Resend
The system SHALL use a Supabase Edge Function and the Resend API as the primary operational email delivery path.

#### Scenario: Pending alert is delivery eligible
- **WHEN** the Edge Function claims a pending high or critical notification within the configured budgets
- **THEN** it sends one transactional email through Resend to the configured developer recipient
- **AND** records the Resend message identifier and successful delivery attempt

#### Scenario: Caller lacks the dispatch secret
- **WHEN** an invocation omits or supplies an invalid operational dispatch bearer secret
- **THEN** the Edge Function returns HTTP 401
- **AND** it does not claim an outbox record or call Resend

### Requirement: Delivery is deduplicated and retried safely
The system SHALL prevent duplicate operational email and SHALL retry transient primary delivery failures without an unbounded loop.

#### Scenario: Delivery is retried after a transient failure
- **WHEN** Resend returns a retryable failure for a claimed notification
- **THEN** the system records a sanitized provider error code
- **AND** makes the notification eligible after an increasing delay
- **AND** stops retrying after five attempts

#### Scenario: Delivery response is uncertain
- **WHEN** the same notification is retried after a timeout or uncertain Resend response
- **THEN** the retry uses the same deterministic Resend idempotency key
- **AND** the developer does not receive duplicate messages within the provider idempotency window

#### Scenario: Same fingerprint recurs during cooldown
- **WHEN** a trusted caller submits an alert fingerprint that was already made email-eligible during the preceding hour
- **THEN** the recurrence is recorded without sending another email

### Requirement: Operational email stays within its free-tier budget
The system SHALL impose an operational-email budget that reserves capacity for existing Auth email.

#### Scenario: Daily budget is available
- **WHEN** fewer than 20 operational notifications have been claimed or delivered during the current UTC day
- **THEN** an otherwise eligible alert can be claimed for delivery

#### Scenario: Daily budget is exhausted
- **WHEN** 20 operational notifications have already been claimed or delivered during the current UTC day
- **THEN** additional notifications are suppressed without calling Resend

#### Scenario: Monthly budget is exhausted
- **WHEN** 300 operational notifications have already been claimed or delivered during the current UTC month
- **THEN** additional notifications are suppressed without calling Resend

#### Scenario: Lower-severity alert is submitted
- **WHEN** a medium or informational alert is submitted to the immediate email channel
- **THEN** it is retained or suppressed without sending an immediate email

#### Scenario: Outbox reaches its storage ceiling
- **WHEN** the operational outbox reaches 3,000 rows
- **THEN** the system prunes the oldest terminal records before accepting more work
- **AND** rejects additional telemetry without affecting the originating customer operation if active work alone prevents pruning

### Requirement: Pending primary delivery recovers without GitHub
The system SHALL retry pending operational email through Supabase-owned trigger and Cron paths and SHALL NOT depend on GitHub workflows, issues, or notifications.

#### Scenario: Immediate dispatch succeeds
- **WHEN** an eligible notification is inserted and Supabase dispatch configuration is available
- **THEN** the database asynchronously invokes the operational Edge Function

#### Scenario: Immediate dispatch is missed
- **WHEN** an eligible notification remains pending after the immediate trigger path
- **THEN** a bounded Supabase Cron retry invokes the same Edge Function within 15 minutes

#### Scenario: GitHub is unavailable
- **WHEN** GitHub services are unavailable or disconnected
- **THEN** operational alert persistence, primary delivery, retry, and Vercel fallback behavior continue unchanged

### Requirement: Operational email content is safe
The system SHALL render fixed text and HTML templates from sanitized fields and SHALL keep all delivery configuration server-only.

#### Scenario: Alert email is rendered
- **WHEN** the system builds an operational email from persisted alert fields
- **THEN** dynamic values are escaped before inclusion in HTML
- **AND** the email includes only approved operational metadata and an optional authenticated details link

#### Scenario: Runtime configuration is inspected by a browser
- **WHEN** the application browser bundle is built or executed
- **THEN** the Resend API key, dispatch secret, developer recipient, and sender configuration are absent
