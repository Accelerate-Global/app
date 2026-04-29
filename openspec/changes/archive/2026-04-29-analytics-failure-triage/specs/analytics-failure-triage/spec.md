## ADDED Requirements

### Requirement: Admins can triage grouped analytics failures
The system SHALL allow dataset admins to classify grouped analytics failure fingerprints as `needs_review`, `debugging`, `expected`, or `resolved`, and SHALL persist a short admin note plus last-triaged audit fields for each explicit classification.

#### Scenario: Admin updates triage
- **WHEN** a dataset admin updates the status or note for a grouped analytics failure fingerprint
- **THEN** the system persists the triage status, note, triaged-by owner, and triaged-at timestamp for that fingerprint

#### Scenario: Non-admin cannot update triage
- **WHEN** an unauthenticated user or non-admin user attempts to update analytics failure triage
- **THEN** the system rejects the request and does not change the triage record

### Requirement: Analytics page distinguishes raw failures from open known failures
The system SHALL keep raw failed event counts and recent raw failures visible while showing open known failures as actionable grouped fingerprints that are either `needs_review` or `debugging`.

#### Scenario: Raw failures include expected outcomes
- **WHEN** failed analytics events include expected user-input outcomes
- **THEN** the failed event count and recent events include those failures
- **AND** open known failures exclude them

#### Scenario: Open known failure has no triage row
- **WHEN** a grouped actionable failure has no explicit triage row
- **THEN** the analytics page treats the group as `needs_review`

#### Scenario: Debugging failure remains open
- **WHEN** a grouped actionable failure is marked `debugging`
- **THEN** the analytics page keeps the group in open known failures with its note and audit state

### Requirement: Expected and resolved failures explain count differences
The system SHALL display expected and resolved failure groups separately from open known failures so admins can understand why raw failed event counts are higher than open known failure counts.

#### Scenario: Expected failure group is separated
- **WHEN** a grouped failure is a built-in expected outcome or is explicitly marked `expected`
- **THEN** the analytics page does not show it as an open known failure
- **AND** the page exposes it as an expected failure group

#### Scenario: Resolved failure group is separated
- **WHEN** a grouped failure is marked `resolved` and no newer matching failure has occurred
- **THEN** the analytics page does not show it as an open known failure
- **AND** the page exposes it as a resolved failure group

### Requirement: Resolved failures reopen after new occurrences
The system SHALL reopen a resolved grouped failure as `needs_review` when a newer matching failure occurs after the recorded triage timestamp.

#### Scenario: New occurrence after resolution
- **WHEN** a grouped failure has a `resolved` triage timestamp older than the group's latest matching event
- **THEN** the analytics page treats the group as `needs_review`
- **AND** the group appears in open known failures

#### Scenario: No new occurrence after resolution
- **WHEN** a grouped failure has a `resolved` triage timestamp newer than or equal to the group's latest matching event
- **THEN** the analytics page keeps the group out of open known failures
