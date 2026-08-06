## ADDED Requirements

### Requirement: Tier 2 onboarding creates exact feed profiles
The system SHALL create a Tier 2 profile from the exact reviewed Sheet tab, durable row-key column, typed tracking-ID column, owner key, unique feed key, and active engagement-mappings contract before the initial import starts.

#### Scenario: Tier 2 feed is configured during onboarding
- **WHEN** all required reviewed fields resolve and the owner has one active source alias
- **THEN** the connection and feed profile are committed atomically
- **AND** the linked connection uses PGAC classification

#### Scenario: Active engagement contract is unavailable
- **WHEN** the active engagement-mappings resource is missing, invalid, or ambiguous
- **THEN** Tier 2 onboarding fails before creating the connection or profile

### Requirement: One owner can manage multiple Tier 2 feeds
The system SHALL permit multiple active Tier 2 profiles to share one owner/partner key while requiring each profile key and Sheet-tab identity to remain unique.

#### Scenario: Accelerate owns two engagement feeds
- **WHEN** Final-58 and Final-Sudan use distinct profile keys and exact Sheet tabs with the same active Accelerate owner key from the source registry
- **THEN** both profiles are valid Tier 2 release members
- **AND** identity reconciliation resolves the shared owner through the same pinned source alias

#### Scenario: Duplicate feed identity is submitted
- **WHEN** another profile uses an existing profile key or exact spreadsheet/tab identity
- **THEN** the system rejects it without altering existing profiles
