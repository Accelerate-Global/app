# live-run-progress Specification

## Purpose
Define truthful, accessible progress feedback for user-triggered tests and dataset ingestions from acceptance through a persisted terminal outcome.

## Requirements

### Requirement: Active operations present truthful progress
The system SHALL keep a user-triggered test or dataset ingestion visibly active from acceptance until a terminal outcome and SHALL distinguish measured progress from lifecycle-only activity.

#### Scenario: Operation exposes measured progress
- **WHEN** the application knows the completed proportion of an active upload, parse, or persistence operation
- **THEN** the UI shows determinate progress based on that measurement
- **AND** visible stage text describes the current work

#### Scenario: Operation exposes lifecycle status only
- **WHEN** an active test or ingestion exposes queued or running status without a completed proportion
- **THEN** the UI shows an indeterminate activity indicator, current phase, and elapsed time
- **AND** the UI does not show a fabricated percentage or estimated completion time

#### Scenario: Active status remains unchanged
- **WHEN** a status refresh confirms that an operation remains queued or running
- **THEN** the UI continues visible activity and updates its status-check freshness
- **AND** the unchanged lifecycle state is not presented as a failure

### Requirement: Progress freshness and terminal outcomes remain observable
The system SHALL distinguish the durable operation outcome from the browser's ability to obtain fresh status and SHALL replace active feedback with the persisted terminal outcome when it becomes available.

#### Scenario: Status refresh is temporarily unavailable
- **WHEN** repeated status refresh requests fail while the last known operation state is queued or running
- **THEN** the UI states that current progress cannot be confirmed
- **AND** retains the last known run state, continues retrying, and does not mark the operation failed

#### Scenario: Status refresh recovers
- **WHEN** a later status refresh succeeds after freshness was unavailable
- **THEN** the UI clears the freshness warning and presents the latest persisted state

#### Scenario: Operation succeeds
- **WHEN** the persisted operation changes from queued or running to success
- **THEN** the UI stops active feedback and presents the successful result and available next action

#### Scenario: Operation fails
- **WHEN** the persisted operation changes from queued or running to failed
- **THEN** the UI stops active feedback and presents the redacted failure result and available recovery action

### Requirement: Progress feedback is accessible without excessive announcements
The system SHALL expose active phase and meaningful progress-state changes to assistive technology while keeping animation and high-frequency elapsed-time changes nonessential.

#### Scenario: Assistive technology observes an active operation
- **WHEN** a test or ingestion becomes queued or running
- **THEN** its named progress state and phase are programmatically available
- **AND** meaningful phase, freshness, success, and failure changes are announced through a polite live region

#### Scenario: Elapsed time advances
- **WHEN** the visible elapsed timer updates while the operation remains in the same phase
- **THEN** the timer does not force a new live-region announcement every second

#### Scenario: User prefers reduced motion
- **WHEN** the user's system requests reduced motion
- **THEN** explicit phase and freshness text remain visible
- **AND** understanding progress does not depend on continuous animation
