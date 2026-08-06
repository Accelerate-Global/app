## ADDED Requirements

### Requirement: Google Sheets onboarding optionally links each tab to a workflow
The system SHALL let an administrator leave each selected Google Sheet tab unlinked or explicitly link it to Accelerate-owned Tier 1 forming, WCD Tier 1 forming, or one named Tier 2 engagement feed before connection creation.

#### Scenario: Administrator leaves a tab unlinked
- **WHEN** an administrator reviews a selected Sheet tab and chooses no workflow
- **THEN** the system creates and imports the ordinary dataset without creating a source-profile binding or Tier 2 profile

#### Scenario: Administrator selects a Tier 1 workflow
- **WHEN** an administrator selects Accelerate-owned or WCD Tier 1 forming and chooses a durable row-key column from the reviewed headers
- **THEN** the final review identifies the exact workflow and stable key
- **AND** the created connection is bound to that Tier 1 workflow before its first import starts

#### Scenario: Administrator selects a Tier 2 workflow
- **WHEN** an administrator identifies the feed owner, feed name, stable row-key column, tracking-ID type, and tracking-ID column from the reviewed headers
- **THEN** the final review identifies the feed as a Tier 2 engagement input
- **AND** the created connection receives one active Tier 2 profile before its first import starts

#### Scenario: Workflow configuration is invalid
- **WHEN** any requested assignment conflicts with an existing active assignment, references an unreviewed column, or lacks a required active contract
- **THEN** the system creates none of the selected connections or workflow links
- **AND** onboarding shows an actionable configuration error

### Requirement: Workflow linkage preserves source roles
The system SHALL distinguish the Accelerate-owned Tier 1 people-groups source from Accelerate-managed Tier 2 engagement feeds.

#### Scenario: Accelerate manages multiple Tier 2 feeds
- **WHEN** Final-58 and Final-Sudan are onboarded as separate Tier 2 feeds owned by Accelerate
- **THEN** each receives its own durable feed profile and exact Sheet-tab identity
- **AND** neither is labeled or processed as the Accelerate-owned Tier 1 people-groups source
