## MODIFIED Requirements

### Requirement: Identity assignment is reviewable before activation
The system SHALL build an identity candidate from one exact formed publication/checksum, base registry revision, identity-rule checksum, and Country/ROP resource versions, preserving per-row reused, newly reserved, PGAC-only, conflicting, and unassignable outcomes without accepting source-supplied AX codes as evidence.

#### Scenario: Candidate contains only assignable rows
- **WHEN** every formed row reuses or reserves the identity required by its dataset classification with no collision
- **THEN** the candidate becomes valid with complete rows, findings, manifest, graph delta, counts, and checksum
- **AND** no reserved authority becomes active until explicit publication

#### Scenario: PGIC row lacks canonical geography
- **WHEN** a PGIC-classified row has no canonical ISO3 after forming
- **THEN** it remains unassignable, creates no PGIC, and consumes no registry number

#### Scenario: Administrator starts a manual identity build
- **WHEN** an administrator submits one exact formed publication
- **THEN** the server resolves one repeatable-read snapshot of the base registry and exact Country/ROP versions already pinned by forming
- **AND** rejects missing, stale, or irreproducible normalization evidence

### Requirement: Identity publication replaces one stable source target safely
The system SHALL pin each source profile's current identity publication during build and SHALL replace that stable dataset only when the pin still matches, while creating a new registry revision only when the active identity graph checksum changes.

#### Scenario: Later data-only candidate publishes
- **WHEN** all source rows reuse existing bindings and the identity graph is unchanged
- **THEN** publication may replace the source dataset while reusing the current registry revision

#### Scenario: Later candidate adds a binding
- **WHEN** a current source row binds to an existing identity without issuing a code
- **THEN** publication creates a new registry revision because graph membership changed

## ADDED Requirements

### Requirement: Source-supplied AX codes are identity-inert
The system SHALL exclude source-supplied AX code fields from identity evidence, matching, allocation, findings, aliases, registry storage, and canonical output decisions.

#### Scenario: Old AX field changes
- **WHEN** two otherwise identical current source publications differ only in source-supplied AX code fields
- **THEN** their identity assignments, graph delta, findings, and canonical output are identical

### Requirement: Identity-component updates require explicit review
The system SHALL compare current normalized evidence with the active binding evidence and present changes to ROP1, source, ROP3, or ISO3 as blocking reviewed events.

#### Scenario: ROP3 changes on a tracked row
- **WHEN** a stable source row resolves to a different current ROP3
- **THEN** the candidate does not silently rewrite its binding and requires an administrator to approve a supported identity decision
