## ADDED Requirements

### Requirement: Required characterization is repository-contained

Required CI characterization SHALL run from version-controlled sanitized fixtures and SHALL NOT require production records, sibling-repository files, or a developer-specific filesystem layout. Production inventory expectations SHALL remain pinned in the repository manifest, and the explicit production-snapshot import workflow SHALL validate every exact input before use.

#### Scenario: Required CI runs without private legacy ledgers

- **WHEN** the required test suite runs in a clean checkout without the sibling AX Data repository
- **THEN** identity reconciliation, stable-key hashing, audit redaction, and deterministic checksum assertions run against committed sanitized fixtures
- **AND** the suite completes without skipping or attempting to read external production ledgers

#### Scenario: Pinned production ledgers are available locally

- **WHEN** an administrator runs the explicit legacy identity import with every checksummed production ledger named by the repository manifest
- **THEN** the import validates each ledger checksum and row count plus the exact expected reconciliation and inventory outcomes before any authority can be created
