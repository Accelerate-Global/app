## MODIFIED Requirements

### Requirement: Existing ROP3 values are validated
The system SHALL retain a source or approved current crosswalk ROP3 only when it resolves exactly in the pinned taxonomy, SHALL write that match's canonical ROP parents, and SHALL keep invalid or conflicting values as raw evidence that blocks publication.

#### Scenario: Source ROP3 resolves exactly
- **WHEN** one exact active ROP3 match exists
- **THEN** the formed row receives that ROP3 and its canonical ROP1, ROP2, and ROP25 values

#### Scenario: Source ROP3 conflicts with current crosswalk evidence
- **WHEN** a nonblank source ROP3 disagrees with one unambiguous independently current tracking-ID crosswalk
- **THEN** both values remain raw evidence and the candidate records a blocking conflict
- **AND** neither value silently replaces the other

## ADDED Requirements

### Requirement: Tier 2 geography is canonical before identity assignment
The system SHALL resolve source country text and current crosswalk geography through the exact pinned country resource and SHALL provide canonical ISO3 or a blocking unresolved/ambiguous finding before PGIC identity assignment.

#### Scenario: Country name resolves without source ISO3
- **WHEN** a Tier 2 row has one uniquely recognized current country name and no ISO3
- **THEN** forming writes its canonical ISO3 and exact country resource lineage

#### Scenario: Canonical geography remains unavailable
- **WHEN** neither source nor approved current crosswalk evidence resolves one canonical ISO3
- **THEN** a PGIC-classified identity row remains unassignable and no registry number is consumed for it
