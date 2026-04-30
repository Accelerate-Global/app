## ADDED Requirements

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
