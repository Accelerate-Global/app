## ADDED Requirements

### Requirement: Tier 2 review excludes AX Data comparison input
The Tier 2 administration and product services SHALL NOT accept, compare, or
store AX Data rows or historical AX identities as review evidence.

#### Scenario: Administrator reviews a Tier 2 product
- **WHEN** a Tier 2 or Aggregate 2 candidate is reviewed
- **THEN** the UI and API expose only exact current publications, current resources, findings, provenance, and AX Online identity evidence
- **AND** no historical comparison upload or matching endpoint exists
