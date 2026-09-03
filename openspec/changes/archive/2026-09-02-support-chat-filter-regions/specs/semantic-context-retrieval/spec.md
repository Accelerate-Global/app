## ADDED Requirements

### Requirement: Trusted geography resolution prevents false off-topic refusal
Before low-confidence refusal, semantic retrieval SHALL consider only server-verified exact country and filter-region resolver signals. A verified signal MAY pin the approved country and population semantic cards and a bounded canonical label, but MUST NOT place full region membership, mutable identifiers, or unreviewed geographic facts into model context.

#### Scenario: Natural India population question reaches the governed query path
- **WHEN** the question contains the reviewed population intent and exact approved country `India`
- **THEN** retrieval supplies the minimum approved country and total-population evidence rather than returning low confidence

#### Scenario: Reviewed filter-region alias reaches planning
- **WHEN** `South Asia` exactly resolves under the checksum-bound region registry
- **THEN** retrieval supplies a trusted resolver view for canonical `Asia, South` and the approved country filter semantic card

#### Scenario: Unrecognized place appears in an otherwise off-topic question
- **WHEN** no exact approved country or filter-region resolver signal exists
- **THEN** the resolver contributes no pinned evidence and the ordinary off-topic/low-confidence policy remains effective

#### Scenario: Client claims an unverified region
- **WHEN** client prose or unsigned state claims that a place is a reviewed region
- **THEN** it cannot produce a resolver view, pin semantic authority, or alter the deterministic filter scope
