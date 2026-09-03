## ADDED Requirements

### Requirement: Latency qualification preserves private-model containment
The system SHALL qualify private-chat latency with sanitized cold and warm phase evidence that distinguishes semantic retrieval, planner prompt ingestion, planner generation, deterministic resolution/query work, grounded-answer work when invoked, provider/relay overhead, and single-slot busy rejection. Measurements MUST NOT retain raw prompts, conversation text, result rows, credentials, authorization headers, model output, or private provider errors.

#### Scenario: Operator measures a representative analytical turn
- **WHEN** an approved sanitized or read-only canary is executed
- **THEN** the resulting evidence reports phase samples plus p50 and p95 summaries sufficient to distinguish model work from application and relay overhead

#### Scenario: Model is cold
- **WHEN** the pinned model has restarted and its planner prefix is absent from the KV cache
- **THEN** cold prompt-ingestion and generation timing is reported separately from subsequent warm requests

#### Scenario: Single inference slot is occupied
- **WHEN** a second valid request arrives while the model slot is active
- **THEN** the gateway rejects it with the existing bounded busy response and the latency evidence records rejection rather than treating it as queued execution

#### Scenario: Optimized application candidate is deployed
- **WHEN** the deterministic analytical-result path is deployed to the exact administrator canary
- **THEN** the unchanged complete one-user production canary MUST pass and replace composed warm-path estimates with measured SSE p50 and p95 evidence before release acceptance or pilot expansion
