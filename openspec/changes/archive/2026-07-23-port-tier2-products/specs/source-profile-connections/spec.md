## ADDED Requirements

### Requirement: Engagement profiles bind stable Sheet identity and mapping
An engagement source profile SHALL persist stable spreadsheet ID, `sheetId`, durable row-key column, partner key, tracking-ID discriminator, and contract version/checksum under administrator control.

#### Scenario: Tab title changes
- **WHEN** a bound partner tab is renamed
- **THEN** the profile continues resolving the same `sheetId` and refreshes safe display metadata without changing identity

#### Scenario: Tier 2 support is deployed without a partner profile
- **WHEN** an administrator attempts partner formation without an active profile carrying every required binding and contract field
- **THEN** the system reports the partner as unconfigured and rejects the run
- **AND** it does not infer a default profile or release member
