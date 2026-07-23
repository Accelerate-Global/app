## ADDED Requirements

### Requirement: Coordinated ingestion reuses existing run lifecycle
The coordinator SHALL start and observe source ingestion through existing API connection run records/artifacts and SHALL not create an alternate unversioned ingestion path.

#### Scenario: Coordinated source stage succeeds
- **WHEN** the existing connection import run archives valid output
- **THEN** the coordinator records that exact run/output checksum as the next-stage input

### Requirement: Source history exposes exact downstream identity anchors
The admin source-run detail SHALL expose the formed source publication and the exact most-recent identity candidate derived from that publication, including its immutable identity publication and registry revision when present.

#### Scenario: Formed source publication has downstream identity work
- **WHEN** an administrator inspects a source run whose formed publication has an identity candidate
- **THEN** the detail links the exact identity run by immutable run ID
- **AND** it shows that run's identity publication and registry revision when they exist
