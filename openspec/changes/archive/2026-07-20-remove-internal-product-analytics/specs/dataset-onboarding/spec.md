## MODIFIED Requirements

### Requirement: Onboarding is accessible, responsive, and privacy-safe
The system SHALL expose the current stage accessibly, move focus to stage content
after navigation, announce asynchronous progress, and remain completable at phone
widths without emitting custom product analytics.

#### Scenario: Keyboard user advances through stages
- **WHEN** a keyboard user advances or returns within onboarding
- **THEN** the current ordered step uses `aria-current="step"`
- **AND** focus moves to the new stage heading without losing valid form state

#### Scenario: Import progress changes
- **WHEN** a connection or upload changes status
- **THEN** the system announces the status through a polite live region and preserves visible status text

#### Scenario: Administrator completes onboarding
- **WHEN** an administrator advances through or completes dataset onboarding
- **THEN** no custom product analytics event is emitted
- **AND** the reviewed connection or dataset workflow otherwise remains unchanged
