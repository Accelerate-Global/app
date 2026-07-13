## MODIFIED Requirements

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
