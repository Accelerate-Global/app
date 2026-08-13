# pipeline-contract-characterization Specification

## Purpose
Preserve a version-controlled, evidence-labeled account of the legacy AX Data flows so migrated behavior can be compared, approved, and reproduced without relying on undocumented assumptions.
## Requirements
### Requirement: Legacy flow behavior has a reviewed inventory
The system repository SHALL contain a version-controlled inventory of every legacy source, forming step, resource, identity rule, merge, aggregate product, and publication outcome, with each rule labeled by its evidence state.

#### Scenario: Engineer evaluates a legacy rule
- **WHEN** an engineer opens the pipeline inventory
- **THEN** the rule is labeled `confirmed by code`, `confirmed by fixture`, `documented only`, `conflicting`, or `unused`
- **AND** the inventory points to the source evidence and intended AX Online stage

#### Scenario: Rule evidence conflicts
- **WHEN** code, retained output, and documentation disagree about a behavior
- **THEN** the decision log records the alternatives and blocks publication enablement for the affected future engine until one expectation is approved

### Requirement: Characterization fixtures are safe and deterministic
The repository SHALL include sanitized fixtures and deterministic expected results for representative source, identity, merge, and aggregate edge cases without including credentials or production records.

#### Scenario: Offline characterization runs twice
- **WHEN** the comparison command runs twice against the checked-in fixture corpus
- **THEN** both executions produce identical columns, rows, findings, identity outcomes, merge winners, provenance, and aggregate totals

#### Scenario: Characterization runs in an isolated environment
- **WHEN** tests run without AX Data, Google Drive, provider APIs, or production Supabase access
- **THEN** the characterization suite completes using only checked-in sanitized inputs

### Requirement: Required characterization is repository-contained
Required CI characterization SHALL run from version-controlled sanitized
fixtures and SHALL NOT require production records, sibling-repository files,
developer-specific paths, AX Data manifests, or a production-snapshot import
workflow.

#### Scenario: Required CI runs without private historical ledgers
- **WHEN** the required test suite runs in a clean checkout
- **THEN** deterministic normalization, stable-key, checksum, and current identity assertions run from repository fixtures
- **AND** no test skips or attempts to read an external repository
