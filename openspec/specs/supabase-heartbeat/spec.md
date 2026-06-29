# supabase-heartbeat Specification

## Purpose
Define the protected production heartbeat that keeps the Supabase Free project
active with one small, read-only application query. The behavior exists to
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
The system SHALL perform a minimal read-only Supabase query when an authorized
heartbeat request is received.

#### Scenario: Supabase read succeeds
- **WHEN** an authorized heartbeat request reaches Supabase
- **AND** Supabase returns a successful result for the read-only query
- **THEN** the endpoint returns HTTP 200
- **AND** the response indicates the heartbeat succeeded

#### Scenario: Supabase read fails
- **WHEN** an authorized heartbeat request reaches Supabase
- **AND** Supabase returns an error for the read-only query
- **THEN** the endpoint returns HTTP 503
- **AND** logs normalized error details without exposing raw provider payloads

#### Scenario: Heartbeat does not mutate data
- **WHEN** the heartbeat query is executed
- **THEN** the query uses a read operation only
- **AND** it does not insert, update, delete, invite, upload, publish, revoke, or
  otherwise mutate production data
