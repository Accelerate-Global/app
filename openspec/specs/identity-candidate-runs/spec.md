# identity-candidate-runs Specification

## Purpose
Define reviewable identity-assignment runs that reconcile formed rows against an exact registry revision, reserve new identities safely, and activate changes only through explicit publication.
## Requirements
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

### Requirement: Rejected and expired reservations remain auditable
The system SHALL cancel reservations associated only with rejected or expired identity candidates while retaining their allocated values and audit history.

#### Scenario: Administrator rejects candidate
- **WHEN** an administrator rejects an undecided candidate with a reason
- **THEN** its reservations become cancelled, its artifacts remain immutable, and its allocated values are never returned to the counter

#### Scenario: Cleanup overlaps candidate publication
- **WHEN** stale-reservation cleanup and publication of the owning candidate run concurrently
- **THEN** both operations serialize through the registry lock
- **AND** cleanup cannot cancel a reservation while publication is activating it

#### Scenario: A pinned dependency advances after build
- **WHEN** a newer registry revision, Country version, or ROP version activates after the candidate is created
- **THEN** the candidate retains its original exact IDs/checksums and does not re-resolve current inputs

### Requirement: Exact-input identity builds have immutable retry attempts
The system SHALL assign a positive immutable attempt number to each build for one exact source publication and input fingerprint, SHALL reuse the one nonterminal or completed reusable attempt under concurrent duplicate requests, and SHALL permit a new attempt only after the prior attempt is failed, expired, or rejected.

#### Scenario: An exact-input build is retried after a terminal failure
- **WHEN** the latest exact-input attempt is failed, expired, or rejected
- **THEN** the next request creates a new run with the next attempt number
- **AND** the terminal attempt, its artifacts, reservations, and audit history remain unchanged

#### Scenario: Concurrent exact-input requests race
- **WHEN** two requests build the same source publication and input fingerprint concurrently
- **THEN** transaction serialization creates at most one reusable attempt
- **AND** both requests resolve to that same attempt rather than duplicating reservations

### Requirement: Identity publication replaces one stable source target safely
The system SHALL pin each source profile's current identity publication during build and SHALL replace that stable dataset only when the pin still matches, while creating a new registry revision only when the active identity graph checksum changes.

#### Scenario: Later data-only candidate publishes
- **WHEN** all source rows reuse existing bindings and the identity graph is unchanged
- **THEN** publication may replace the source dataset while reusing the current registry revision

#### Scenario: Later candidate adds a binding
- **WHEN** a current source row binds to an existing identity without issuing a code
- **THEN** publication creates a new registry revision because graph membership changed

### Requirement: Publication verifies every reviewed artifact
The system SHALL verify stored rows, findings, manifest, and CSV against immutable audit checksums and deterministic candidate evidence before publication.

#### Scenario: Stored CSV bytes change after review
- **WHEN** the CSV blob no longer matches its recorded checksum or regenerated reviewed rows
- **THEN** publication stops before claiming or replacing the stable target
- **AND** the previously current dataset and publication remain authoritative

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
