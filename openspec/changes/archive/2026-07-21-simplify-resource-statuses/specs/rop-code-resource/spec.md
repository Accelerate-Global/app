## MODIFIED Requirements

### Requirement: ROP code resource flattens the hierarchy into one table
The system SHALL render a single searchable table with one matched field each
for ROP1, ROP2, ROP25, and ROP3.

#### Scenario: User views flattened ROP rows
- **WHEN** a signed-in user views the ROP resource table
- **THEN** each visible row shows one ROP1 field, one ROP2 field, one ROP25
  field, and one ROP3 field
- **AND** each populated field combines the code and name for that ROP term
- **AND** the row set includes ROP3 people and ROP25 parent-only rows with no
  ROP3 child
- **AND** a ROP25 parent-only row shows `Not listed` for ROP3 without a warning
  icon or join-issue badge

#### Scenario: Source parent links are imperfect
- **WHEN** a ROP3 row has a missing ROP25 parent or a conflicting direct ROP2
  value
- **THEN** the row remains visible
- **AND** the system uses the registry-chain match when available
- **AND** the row exposes a join issue label for inspection and download
- **AND** the table retains a warning icon for the genuine join issue

### Requirement: ROP code resource is searchable, downloadable, and inspectable
The system SHALL allow signed-in users to search, download, page through, and
inspect the complete active ROP version without changing workspace data.

#### Scenario: User searches the ROP resource
- **WHEN** a signed-in user searches by ROP code, ROP name, source fields,
  place, language, status, geography, or join issue text
- **THEN** matching rows from the complete active version remain visible in a
  deterministic cursor-paged result

#### Scenario: User views ROP resource summary
- **WHEN** a signed-in user views the ROP resource
- **THEN** the summary shows ROP1, ROP2, ROP25, and ROP3 source counts and the
  source retrieval time
- **AND** the summary does not show a browser-page “loaded of total” badge

#### Scenario: User downloads matching ROP rows
- **WHEN** a signed-in user downloads the current ROP query
- **THEN** the system streams a CSV containing every matching row from the
  active version, including rows not loaded in the current browser page
- **AND** the CSV contains the four matched ROP term fields plus source, status,
  geography, and join issue metadata

#### Scenario: User opens a ROP detail sheet
- **WHEN** a signed-in user selects a visible ROP row
- **THEN** a right-side detail sheet opens for that row
- **AND** the sheet shows code, name, description, status, source metadata, and
  actionable join issue details
- **AND** ROP3 geography rows from the same active version are shown when
  available

### Requirement: ROP code resource validates source shape
The system SHALL mark a ROP candidate invalid when it has malformed rows,
duplicate codes, suspiciously low table counts, invalid required hierarchy
links, or inconsistent package artifacts, projections, counts, or checksum.

#### Scenario: HIS candidate is valid
- **WHEN** all required HIS layers return valid rows above their completeness
  safety floors and package integrity checks pass
- **THEN** the system produces sorted typed ROP term, people, and geography
  projections
- **AND** the candidate becomes eligible for explicit activation

#### Scenario: HIS ROP25 count changes within the safety buffer
- **WHEN** the complete HIS ROP25 layer contains 8,991 valid unique rows
- **THEN** the source-count safeguard accepts the layer for candidate building
- **AND** the remaining hierarchy and package validations still run

#### Scenario: HIS candidate is invalid
- **WHEN** a required layer returns malformed rows, duplicate codes, a row count
  below its completeness safety floor, invalid hierarchy data, or inconsistent
  package content
- **THEN** the system persists structured validation findings
- **AND** the candidate cannot replace the active version

#### Scenario: ROP version is bootstrapped
- **WHEN** the existing generated ROP resource is imported into typed
  projections and private artifacts
- **THEN** validation proves exact entry, term, geography, join-issue count, and
  canonical checksum parity before activation
