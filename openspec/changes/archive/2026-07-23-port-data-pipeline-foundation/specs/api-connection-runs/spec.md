## ADDED Requirements

### Requirement: Import snapshots advertise registered forming eligibility
The system SHALL derive forming eligibility from the deployed source profile and registered engine instead of hard-coding candidate behavior to one connection identifier.

#### Scenario: Engine-managed import succeeds
- **WHEN** a source profile with a registered forming engine completes an import and archives complete checksummed artifacts
- **THEN** the run detail identifies the eligible engine and offers generic candidate actions
- **AND** source rows are not treated as a reviewed published dataset until a valid candidate is explicitly published

#### Scenario: Source is not engine-managed
- **WHEN** an import succeeds for a source profile without a registered engine
- **THEN** the existing source-specific import behavior remains unchanged
- **AND** the UI does not offer an unsupported forming action

### Requirement: Run detail presents generic candidate metadata
The run-detail surface SHALL render generic engine, resource, lifecycle, finding, artifact, and decision data without exposing source-specific internal implementation names.

#### Scenario: Administrator inspects a candidate
- **WHEN** an administrator selects an engine-managed run with a candidate
- **THEN** the drawer shows its source engine label, lifecycle, counts, bindings, findings, downloads, and available decisions
- **AND** long identifiers and checksums remain contained, truncated, and copyable
