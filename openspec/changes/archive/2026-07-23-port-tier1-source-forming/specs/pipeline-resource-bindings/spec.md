## ADDED Requirements

### Requirement: Tier 1 engines pin complete dependency sets
Each Tier 1 forming engine SHALL bind its exact Country/ROG, ROP when applicable, source-alias resource, source-specific crosswalks, field contract, type contract, and transformation contract before execution.

#### Scenario: Contract changes after candidate build
- **WHEN** a field/type contract or catalog resource changes after a candidate is finalized
- **THEN** the existing candidate and publication retain their original bindings and checksum
- **AND** a rebuild with current resources creates a distinct candidate
