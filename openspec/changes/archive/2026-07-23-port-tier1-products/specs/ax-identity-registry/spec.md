## ADDED Requirements

### Requirement: Tier 1 releases pin registry revision
Every Tier 1 merge release SHALL bind one immutable AX registry revision compatible with all source identity publications.

#### Scenario: Source identities use different revisions
- **WHEN** selected input publications cannot be reconciled to the chosen registry revision
- **THEN** the release cannot finalize
