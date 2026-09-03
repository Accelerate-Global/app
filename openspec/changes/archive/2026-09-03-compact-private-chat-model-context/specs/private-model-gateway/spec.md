## MODIFIED Requirements

### Requirement: Latency qualification preserves private-model containment
The system SHALL qualify private-chat latency with sanitized cold and warm phase evidence that distinguishes semantic retrieval, planner prompt ingestion, planner generation, deterministic resolution/query work, grounded-answer work when invoked, provider/relay overhead, and single-slot busy rejection. Planner inference SHALL receive selected reviewed semantic items exactly once in a canonical evidence envelope with explicit non-instruction authority; snapshot hashes, retrieval views, exact-match bookkeeping, byte counts, and duplicate serialization SHALL remain application-side validation/audit data. Measurements MUST NOT retain raw prompts, conversation text, result rows, credentials, authorization headers, model output, or private provider errors.

#### Scenario: Planner receives retrieved semantic evidence
- **WHEN** application retrieval returns a validated ready context
- **THEN** the gateway sends the selected reviewed items once with their policy version and `instructionAuthority: false`, while omitting application-only retrieval metadata

#### Scenario: Operator measures varied analytical turns
- **WHEN** an approved sanitized or read-only canary executes distinct questions with different selected cards
- **THEN** the resulting evidence reports prompt-token, phase, and browser p50/p95 summaries without treating repeated identical-context cache reuse as representative of the varied workload

#### Scenario: Single inference slot is occupied
- **WHEN** a second valid request arrives while the model slot is active
- **THEN** the gateway rejects it with the existing bounded busy response and the latency evidence records rejection rather than treating it as queued execution

#### Scenario: Compacted candidate is deployed
- **WHEN** the canonical semantic-evidence envelope is deployed to the exact administrator canary
- **THEN** the unchanged complete one-user production canary MUST pass before release acceptance or pilot expansion
