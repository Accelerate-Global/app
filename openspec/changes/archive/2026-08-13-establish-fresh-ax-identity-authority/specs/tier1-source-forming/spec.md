## MODIFIED Requirements

### Requirement: Source formation preserves readable rows and evidence
The system SHALL preserve every structurally readable source row and original raw evidence while resolving unique current country aliases to canonical ISO3 and exact current ROP3 to canonical ROP parents through pinned resources, and reporting unresolved, ambiguous, or conflicting values through structured findings.

#### Scenario: ROP3 resolves with canonical parents
- **WHEN** a source ROP3 has one exact active pinned match
- **THEN** forming writes the match's canonical ROP1, ROP2, and ROP25 values and records any source-parent discrepancy

#### Scenario: Country name resolves uniquely without ISO3
- **WHEN** source ISO3 is blank and its country name or approved alias has one exact pinned match
- **THEN** forming writes canonical ISO3 and country display name with exact resource lineage

#### Scenario: Country or ROP cannot resolve
- **WHEN** source geography or ROP evidence has no unambiguous pinned match
- **THEN** the row remains in the candidate with raw evidence and a finding
- **AND** the system does not invent, fuzzily match, or silently drop the row
