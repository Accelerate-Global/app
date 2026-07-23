## ADDED Requirements

### Requirement: Identity assignment is reviewable before activation
The system SHALL build an identity candidate from one exact formed publication/checksum, base registry revision, identity-rule checksum, and Country/ROP resource version IDs/checksums, preserving per-row reused, source-retained, newly reserved, conflicting, and unassignable outcomes.

#### Scenario: Candidate contains only assignable rows
- **WHEN** every formed row reuses or reserves a valid identity with no collisions
- **THEN** the candidate becomes valid with complete enriched rows, findings, manifest, counts, and checksum
- **AND** no reserved binding is active until explicit publication

#### Scenario: Candidate contains a conflict
- **WHEN** a source code collides, stable key is missing/duplicated, or identity components are invalid
- **THEN** the row and evidence remain inspectable with blocking findings
- **AND** the candidate cannot publish

#### Scenario: Administrator starts a manual identity build
- **WHEN** an administrator submits one exact formed publication
- **THEN** the server resolves one repeatable-read snapshot of the exact base registry revision and active Country/ROP version IDs and checksums
- **AND** the build rejects missing or mismatched pins instead of silently substituting a later current resource

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
The system SHALL pin each source profile's current identity publication during build and SHALL replace that profile's stable dataset only when the pin still matches at commit.

#### Scenario: Two candidates race for one source target
- **WHEN** two valid candidates were built from the same current identity publication
- **THEN** one candidate may publish under the per-target lock
- **AND** the second candidate is refused after the target changes and cannot replace the winner

#### Scenario: A later reviewed candidate publishes
- **WHEN** a candidate pins the current publication and publishes successfully
- **THEN** it reuses the stable dataset ID, archives the prior dataset version, and creates a new immutable publication anchor
- **AND** history identifies the new anchor as current and the previous anchor as a prior version

### Requirement: Publication verifies every reviewed artifact
The system SHALL verify stored rows, findings, manifest, and CSV against immutable audit checksums and deterministic candidate evidence before publication.

#### Scenario: Stored CSV bytes change after review
- **WHEN** the CSV blob no longer matches its recorded checksum or regenerated reviewed rows
- **THEN** publication stops before claiming or replacing the stable target
- **AND** the previously current dataset and publication remain authoritative
