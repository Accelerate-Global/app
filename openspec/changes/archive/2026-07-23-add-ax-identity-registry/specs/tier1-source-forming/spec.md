## ADDED Requirements

### Requirement: Tier 1 identity enrichment preserves formed lineage
An identity-enriched Tier 1 publication SHALL reference every output row's exact formed source publication and authoritative AX registry binding without modifying the formed candidate.

#### Scenario: Identity-enriched source publishes
- **WHEN** an administrator publishes a valid identity candidate
- **THEN** each row includes canonical PGAC/PGIC values and source-binding lineage
- **AND** downstream merge eligibility references the identity publication and registry revision
