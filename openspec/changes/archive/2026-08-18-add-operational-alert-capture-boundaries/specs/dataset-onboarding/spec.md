## ADDED Requirements

### Requirement: Confirmed CSV failures notify operations safely
The system SHALL submit a sanitized operational alert when a confirmed CSV upload or import fails during authorization, transfer, parsing, creation, replacement, or row persistence, without including file or row content.

#### Scenario: Confirmed CSV operation fails
- **WHEN** an administrator has confirmed a CSV operation and an execution stage fails
- **THEN** the system submits an alert containing only the fixed operation and stage categories plus bounded internal identifiers
- **AND** preserves the existing failed progress, cleanup, and retry experience

#### Scenario: CSV is rejected before confirmation
- **WHEN** local type, size, header, or required-selection validation rejects a CSV before transfer begins
- **THEN** the system does not submit an operational alert
