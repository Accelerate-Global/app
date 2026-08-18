# supabase-heartbeat Specification

## Purpose
Define the protected production heartbeat that keeps the Supabase Free project
active with three small, read-only application queries. The behavior exists to
prevent inactivity pauses without generating fake load, mutating production
data, or exposing an unauthenticated operational endpoint.
## Requirements
### Requirement: Cron heartbeat requires bearer authentication
The system SHALL expose a production heartbeat endpoint that only accepts
requests authorized with the configured Vercel cron bearer secret.

#### Scenario: Authorized heartbeat request
- **WHEN** a GET request to `/api/ops/supabase-heartbeat` includes an
  `Authorization` header matching `Bearer <CRON_SECRET>`
- **THEN** the endpoint proceeds to the Supabase heartbeat check

#### Scenario: Missing or invalid heartbeat authorization
- **WHEN** a GET request to `/api/ops/supabase-heartbeat` omits the
  `Authorization` header or sends a value that does not match `CRON_SECRET`
- **THEN** the endpoint returns HTTP 401
- **AND** no Supabase query is attempted

#### Scenario: Missing cron secret configuration
- **WHEN** `CRON_SECRET` is not configured for the runtime
- **THEN** the endpoint returns HTTP 500
- **AND** no Supabase query is attempted

### Requirement: Heartbeat performs a read-only Supabase check
The system SHALL perform three distinct, bounded, read-only Supabase database
requests when an authorized heartbeat request is received. Each request MUST
read only the `id` column from at most one row of the stable heartbeat table.

#### Scenario: Supabase reads succeed
- **WHEN** an authorized heartbeat request reaches Supabase
- **AND** all three read-only requests succeed
- **THEN** the endpoint returns HTTP 200
- **AND** the response indicates the heartbeat succeeded

#### Scenario: A Supabase read fails
- **WHEN** an authorized heartbeat request reaches Supabase
- **AND** any read-only request returns an error
- **THEN** the endpoint returns HTTP 503
- **AND** logs normalized error details without exposing raw provider payloads
- **AND** the endpoint does not attempt later heartbeat reads

#### Scenario: Heartbeat does not mutate data
- **WHEN** the heartbeat requests are executed
- **THEN** every request uses a read operation only
- **AND** none insert, update, delete, invite, upload, publish, revoke, or
  otherwise mutate production data

### Requirement: Supabase heartbeat has a Resend outage fallback
The system SHALL attempt a direct Resend operational email when an authorized Vercel heartbeat detects that Supabase is unavailable.

#### Scenario: Supabase read fails and email is configured
- **WHEN** an authorized heartbeat request receives an error from any bounded read-only Supabase check
- **THEN** the heartbeat sends a sanitized high-severity outage email directly through Resend
- **AND** uses a deterministic daily idempotency key
- **AND** returns the existing HTTP 503 heartbeat response

#### Scenario: Supabase read fails and email delivery also fails
- **WHEN** the heartbeat detects a Supabase failure but Resend configuration or delivery fails
- **THEN** the heartbeat logs normalized email-delivery details
- **AND** returns the existing HTTP 503 Supabase heartbeat response
- **AND** does not attempt to persist the fallback alert in Supabase

#### Scenario: Supabase reads succeed
- **WHEN** all authorized heartbeat reads succeed
- **THEN** the heartbeat does not call Resend
- **AND** returns the existing HTTP 200 success response
