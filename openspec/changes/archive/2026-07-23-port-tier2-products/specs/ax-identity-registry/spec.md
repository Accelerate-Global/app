## ADDED Requirements

### Requirement: Registry spans Tier 1 and Tier 2
The authoritative AX registry SHALL prevent canonical, alias, and allocated-value collisions across Tier 1 and Tier 2 while preserving distinct source-profile row bindings.

#### Scenario: Tier 2 allocation would collide with Tier 1
- **WHEN** a candidate attempts to reserve an allocated number or canonical code already used by Tier 1
- **THEN** the transaction rejects the collision and records a candidate conflict
