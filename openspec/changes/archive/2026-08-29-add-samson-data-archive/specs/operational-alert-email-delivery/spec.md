## ADDED Requirements

### Requirement: Samson backup failures reach the operational email destination
The system SHALL deliver sanitized high-severity backup, archive, pruning, integrity, capacity, missed-run, and recovery failures to the existing operational email destination even when Supabase or the normal outbox path is unavailable.

#### Scenario: Signed backup receipt reports a failure while Supabase is healthy
- **WHEN** Samson submits an authenticated sanitized failure receipt and the operational outbox is available
- **THEN** the existing outbox, cooldown, budget, retry, and Resend controls deliver the alert

#### Scenario: Supabase or receipt delivery is unavailable
- **WHEN** Samson cannot persist a required failure through the normal operational outbox
- **THEN** Samson uses a bounded direct Resend fallback to the same configured destination
- **AND** applies a deterministic idempotency key and local rate limit

#### Scenario: Backup alert content is rendered
- **WHEN** Samson or the application renders a backup-related alert
- **THEN** it contains only approved status, run identity, timestamps, counts, severity, normalized reason, and authenticated recovery guidance
- **AND** excludes database rows, Auth records, object bodies, filenames, provider payloads, credentials, local paths, and recovery keys

#### Scenario: Backup succeeds normally
- **WHEN** a nightly backup, receipt, integrity check, and capacity check all succeed
- **THEN** the system records success without consuming high-severity failure-email capacity
- **AND** may send only the configured bounded summary
