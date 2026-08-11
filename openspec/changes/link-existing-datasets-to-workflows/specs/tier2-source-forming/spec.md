## ADDED Requirements

### Requirement: Existing connections can receive exact Tier 2 profiles
The system SHALL allow an administrator to configure an unassigned existing Google Sheets connection as a Tier 2 feed using its exact Sheet identity, reviewed durable row key, tracking field and fixed or row-specific source contract, owner key, unique feed key, and active engagement contract.

#### Scenario: Existing engagement dataset is linked
- **WHEN** an administrator submits a complete Tier 2 assignment for an ordinary active connection
- **THEN** the system creates one active Tier 2 profile and changes the linked dataset classification to PGAC in the same transaction
- **AND** it does not import, form, publish, or allocate an identity as part of the assignment

#### Scenario: Feed profile conflicts
- **WHEN** the feed key, exact spreadsheet/tab identity, owner alias, or required reviewed field is invalid or conflicts with an active profile
- **THEN** the request fails without creating a profile or changing dataset classification

### Requirement: Mixed tracking sources resolve explicitly per row
The system SHALL support a reviewed tracking-source column with an exact mapping from source values to supported identity types and SHALL NOT use a fallback type for unmapped values.

#### Scenario: Row has a reviewed tracking-source value
- **WHEN** a Tier 2 row's discriminator exactly matches a configured normalized source value
- **THEN** the forming engine resolves that row using the mapped PeopleID3, PEID, ROP3, or provider-native identity type
- **AND** records the resolved type in the formed output and later identity evidence

#### Scenario: Row tracking source is blank or unknown
- **WHEN** a row-specific profile receives a blank or unmapped tracking-source value
- **THEN** the forming engine records a blocking finding for that row
- **AND** does not infer a type from the tracking ID, evidence columns, or neighboring rows

### Requirement: Tier 2 source rows use permanent source-owned IDs
The system SHALL require a reviewed, populated, unique permanent source-row ID column and SHALL NOT substitute row positions, mutable names, or tracking IDs.

#### Scenario: Permanent ID is missing or duplicated
- **WHEN** a source row has a blank permanent ID or multiple rows share one ID
- **THEN** the forming candidate is invalid and identifies every affected row
