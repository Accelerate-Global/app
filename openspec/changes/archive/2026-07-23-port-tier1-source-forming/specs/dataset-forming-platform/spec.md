## ADDED Requirements

### Requirement: Shared forming supports source-specific summaries
The generic candidate lifecycle SHALL preserve source-specific structured validation details while maintaining common status, counts, artifacts, decisions, and publication rules.

#### Scenario: Different engines report domain findings
- **WHEN** two registered engines produce different source-specific finding categories
- **THEN** the candidate API exposes their common counts and safe structured summary
- **AND** the run-detail UI remains generic
