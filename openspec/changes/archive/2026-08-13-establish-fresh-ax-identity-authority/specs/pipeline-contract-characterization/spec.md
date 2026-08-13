## MODIFIED Requirements

### Requirement: Required characterization is repository-contained
Required CI characterization SHALL run from version-controlled sanitized
fixtures and SHALL NOT require production records, sibling-repository files,
developer-specific paths, AX Data manifests, or a production-snapshot import
workflow.

#### Scenario: Required CI runs without private historical ledgers
- **WHEN** the required test suite runs in a clean checkout
- **THEN** deterministic normalization, stable-key, checksum, and current identity assertions run from repository fixtures
- **AND** no test skips or attempts to read an external repository
