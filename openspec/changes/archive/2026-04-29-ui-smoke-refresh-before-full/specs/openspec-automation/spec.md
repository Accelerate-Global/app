## ADDED Requirements

### Requirement: Targeted-and-full smoke refreshes full-suite fixtures
The repository SHALL refresh UI smoke bootstrap fixtures before starting the
full smoke suite when one command runs targeted smoke followed by full smoke.

#### Scenario: Targeted auth smoke consumes the signup email
- **WHEN** the UI smoke runner executes targeted smoke and then full smoke in a
  single invocation
- **THEN** the runner regenerates smoke bootstrap data before the full suite
- **AND** the full suite receives a fresh allowlisted signup email

#### Scenario: Single-suite smoke does not refresh between suites
- **WHEN** the UI smoke runner executes only targeted smoke or only full smoke
- **THEN** it does not perform an extra between-suite bootstrap refresh
