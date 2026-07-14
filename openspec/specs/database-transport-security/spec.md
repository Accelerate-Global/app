# database-transport-security Specification

## Purpose
Define how application and verification processes establish encrypted,
certificate-verified connections to hosted Postgres while preserving compatible
loopback connections for the repository's local Supabase stack.

## Requirements
### Requirement: Production database traffic uses verified TLS
The system MUST encrypt non-local Postgres connections and MUST verify the database certificate and requested hostname when the production CA is configured. Loopback Supabase development MAY remain non-TLS.

#### Scenario: Production runtime opens a database connection
- **WHEN** the application connects to a non-local Postgres host with the configured Supabase CA
- **THEN** the connection uses TLS with certificate and hostname verification

#### Scenario: Local Supabase opens a database connection
- **WHEN** repository verification connects to loopback Supabase
- **THEN** the connection remains compatible with the local non-TLS Postgres service

### Requirement: Hosted Postgres rejects plaintext connections
The linked Supabase project MUST enforce SSL for external Postgres and pooler connections after the verified application connection is proven usable.

#### Scenario: Plaintext client connects to hosted Postgres
- **WHEN** a client attempts a non-TLS connection after enforcement is enabled
- **THEN** Supabase rejects the connection

### Requirement: Database credential rotation is atomic
Database password rotation MUST update every repository-owned runtime and verification consumer before the old credential is considered retired.

#### Scenario: Automated rotation is available
- **WHEN** the database password, Vercel production variable, and local verification configuration can be updated and tested in one controlled sequence
- **THEN** the password is rotated and the application is verified with the new credential

#### Scenario: Atomic rotation is unavailable
- **WHEN** any required credential consumer cannot be updated or verified by the same operator
- **THEN** the system retains the current password rather than leaving partial credential state
