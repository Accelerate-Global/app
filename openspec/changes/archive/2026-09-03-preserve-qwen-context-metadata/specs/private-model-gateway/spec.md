## MODIFIED Requirements

### Requirement: Latency qualification preserves private-model containment
The system SHALL qualify private-chat latency with sanitized cold and warm phase evidence that distinguishes semantic retrieval, planner prompt ingestion, planner generation, deterministic resolution/query work, grounded-answer work when invoked, provider/relay overhead, and single-slot busy rejection. Planner inference SHALL preserve the validated retrieval status, snapshot and policy identity, controlled retrieval views, exact-match keys, context byte count, selected reviewed items, and explicit non-instruction authority while omitting the duplicate serialized copy of those items. Measurements MUST NOT retain raw prompts, conversation text, result rows, credentials, authorization headers, model output, or private provider errors.

#### Scenario: Planner receives retrieved semantic evidence
- **WHEN** application retrieval returns a validated ready context
- **THEN** the gateway preserves its established validation and selection metadata, sends the reviewed items once with `instructionAuthority: false`, and omits only the duplicate serialized item envelope

#### Scenario: Compaction changes a supported decision
- **WHEN** a canary returns clarification or refusal for an unchanged supported query case
- **THEN** production is rolled back, pilot scope is not expanded, and the optimization cannot be accepted until the exact regression and complete suite pass

#### Scenario: Operator measures varied analytical turns
- **WHEN** an approved sanitized or read-only canary executes distinct questions with different selected cards
- **THEN** the resulting evidence reports prompt-token, phase, and browser p50/p95 summaries without treating repeated identical-context cache reuse as representative of the varied workload

#### Scenario: Single inference slot is occupied
- **WHEN** a second valid request arrives while the model slot is active
- **THEN** the gateway rejects it with the existing bounded busy response and the latency evidence records rejection rather than treating it as queued execution
