## ADDED Requirements

### Requirement: Formed publications are immutable identity inputs
The system SHALL expose an exact publication identifier, source-profile key, output checksum, row count, and artifact binding for each published formed dataset used by identity runs.

#### Scenario: Dataset is later replaced
- **WHEN** a newer formed candidate publishes to the same workspace dataset
- **THEN** prior identity runs still resolve the original publication and artifacts
- **AND** are not silently rebound to the current dataset rows
