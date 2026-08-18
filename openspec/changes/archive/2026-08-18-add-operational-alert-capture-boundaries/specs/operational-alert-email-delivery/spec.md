## ADDED Requirements

### Requirement: Trusted capture boundaries use bounded delivery
The system SHALL route eligible connection, pipeline, authentication, and upload capture events through the existing operational outbox, cooldown, quota, retry, and Resend delivery controls.

#### Scenario: Capture boundary submits an eligible event
- **WHEN** a trusted server boundary submits a sanitized high or critical event
- **THEN** the existing outbox applies idempotency, fingerprint cooldown, daily and monthly budgets, and bounded Resend delivery

#### Scenario: GitHub is disconnected
- **WHEN** GitHub services or repository integrations are unavailable
- **THEN** application capture and operational email delivery continue without behavior changes
