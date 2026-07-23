## ADDED Requirements

### Requirement: Candidate operations are coordinator-idempotent
Starting or resuming a forming stage with the same input fingerprint SHALL resolve one active candidate and SHALL not duplicate immutable candidate effects.

#### Scenario: Coordinator retries start
- **WHEN** the same source/resource/engine fingerprint is submitted after an uncertain response
- **THEN** the lifecycle returns the existing active candidate or one deterministic terminal result
