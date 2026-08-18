## ADDED Requirements

### Requirement: Failed connection runs notify operations
The system SHALL submit a sanitized operational alert after a connection test or import run is durably recorded as failed, without changing the existing redacted run lifecycle.

#### Scenario: Run failure is persisted
- **WHEN** an upstream request, parsing step, output persistence step, or dataset import step records a failed connection run
- **THEN** the system submits one high-severity alert associated with the run and safe failure category
- **AND** the run remains failed even if alert submission is unavailable

#### Scenario: Run does not fail
- **WHEN** a connection run succeeds, remains queued or running, or is cancelled by an administrator
- **THEN** the system does not submit a connection-failure alert
