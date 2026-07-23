## ADDED Requirements

### Requirement: Protected dependency audit clears the release threshold
The repository SHALL resolve the complete installed production and developer dependency graph without critical or high-severity advisories before a release can merge.

#### Scenario: Release candidate is audited
- **WHEN** the protected dependency audit evaluates the lockfile used by the release candidate
- **THEN** the audit exits successfully at the high-severity threshold
- **AND** the repository does not suppress or waive a critical or high-severity finding

#### Scenario: Patched transitive dependency crosses a compatibility boundary
- **WHEN** clearing an advisory requires a transitive override outside the parent package declared range
- **THEN** the package-dependent workflow and full application verification MUST pass with the exact resolved lockfile
- **AND** the protected dependency audit MUST pass before merge
