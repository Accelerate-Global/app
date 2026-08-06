## ADDED Requirements

### Requirement: Tier 1 workflow bindings can be created during onboarding
The system SHALL create a requested WCD or Accelerate-owned source-profile binding in the same transaction as its reviewed Google Sheets connection.

#### Scenario: Onboarding creates a valid Tier 1 binding
- **WHEN** an administrator selects one available Tier 1 profile and a reviewed stable-key column for a Sheet tab
- **THEN** the system creates the connection and private binding atomically
- **AND** the linked connection uses PGIC classification

#### Scenario: Tier 1 profile is already bound
- **WHEN** onboarding requests a Tier 1 profile that is already assigned to another active connection
- **THEN** the database rejects the complete onboarding transaction without replacing the existing binding
