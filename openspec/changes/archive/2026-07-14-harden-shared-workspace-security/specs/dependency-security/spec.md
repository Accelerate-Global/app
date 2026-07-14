## ADDED Requirements

### Requirement: Compatible lower-severity dependency advisories are remediated
The repository SHALL update or override moderate and low advisory paths when the patched versions remain compatible with application and verification workflows.

#### Scenario: Dependency updates are selected
- **WHEN** a moderate or low advisory has a compatible patched dependency release
- **THEN** the lockfile resolves the affected path to the patched release
- **AND** package-dependent tests and the full application verification lane pass

#### Scenario: Patch requires a breaking workflow change
- **WHEN** clearing a lower-severity advisory would require an unverified major framework or workflow replacement
- **THEN** the system retains the compatible version and records the advisory rather than silently breaking the application
