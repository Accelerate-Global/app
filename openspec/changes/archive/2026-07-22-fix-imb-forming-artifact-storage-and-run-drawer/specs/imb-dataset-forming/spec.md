## MODIFIED Requirements

### Requirement: IMB candidates expose structured validation and immutable artifacts
The system SHALL finalize each forming attempt as a valid, invalid, or failed inspectable candidate with deterministic counts, summaries, complete private JSON and CSV artifacts, and output checksum. Artifact persistence failures SHALL retain a safe user-facing message and produce normalized operator diagnostics without exposing credentials or raw provider objects.

#### Scenario: Candidate has warnings only
- **WHEN** formation completes with preserved row counts, valid lineage, complete artifacts, and only domain/conversion warnings
- **THEN** the candidate becomes valid and reviewable
- **AND** warnings do not publish or reject it automatically

#### Scenario: Candidate has blocking errors
- **WHEN** formation detects a structural error or cannot verify artifact/count/checksum integrity
- **THEN** the candidate becomes invalid or failed with normalized findings/error details
- **AND** it cannot be published

#### Scenario: Candidate artifacts are persisted
- **WHEN** formation successfully generates rows, findings, lineage manifest, and CSV content within the configured object-size bound
- **THEN** all four artifacts are stored privately with their expected content types
- **AND** the candidate can finalize as valid or invalid instead of failing because CSV is disallowed

#### Scenario: Candidate artifact upload fails
- **WHEN** private artifact storage rejects an upload
- **THEN** previously uploaded artifacts for that forming attempt are removed
- **AND** the candidate shows a safe normalized failure while operators receive normalized provider diagnostics

#### Scenario: Candidate artifacts are requested
- **WHEN** a dataset admin downloads formed rows, findings, or lineage manifest for a finalized candidate
- **THEN** the server streams the immutable private artifact through a guarded endpoint
- **AND** browser roles cannot access Storage or control tables directly
