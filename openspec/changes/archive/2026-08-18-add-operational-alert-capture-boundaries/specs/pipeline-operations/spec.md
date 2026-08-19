## ADDED Requirements

### Requirement: Terminal pipeline failures notify operations
The system SHALL submit a sanitized operational alert when a pipeline failure transition makes the overall run terminally failed.

#### Scenario: Retry remains available
- **WHEN** a stage attempt fails but the pipeline remains eligible for automatic retry
- **THEN** the system records the attempt under the existing lifecycle without submitting a terminal failure alert

#### Scenario: Pipeline is terminally failed
- **WHEN** failure handling returns an overall failed run status
- **THEN** the system submits one high-severity alert containing safe flow, stage, effect, and error-code categories
- **AND** preserves the existing failed run state if alert submission is unavailable
