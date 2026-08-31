## MODIFIED Requirements

### Requirement: Semantic regression evaluation is release-blocking
The system SHALL maintain a sanitized, versioned capability-evaluation suite covering supported, ambiguous, unsupported, adversarial, multi-turn, controlled-value alias, null/boundary, authorization, prompt-injection, grounded-answer, and end-to-end read-only behavior. The suite SHALL preserve a compact compatibility baseline and SHALL provide cumulative smoke, core, and extended execution tiers. Every case MUST identify its capability, risk, inputs, expected semantic outcome, and deterministic scoring rubric. Golden query decisions MUST validate against the active schema and catalog revision and MUST compile to the expected selected concepts and positional parameters.

The system SHALL generate a deterministic human-readable review inventory containing every proposed prompt, conversation turn, synthetic fixture, expected decision, and rubric. Review generation and static validation MUST perform no model, gateway, network, production API, or database call. Live execution MUST remain a separate explicit operation and MUST NOT occur before the proposed corpus and execution tier receive human approval. A prompt, schema, catalog, compiler-policy, model, runtime, or fixture change MUST produce a fresh pinned live-Qwen receipt before release.

#### Scenario: Reviewer inspects the proposed corpus
- **WHEN** the review inventory is generated from the versioned suite
- **THEN** every expanded case and expected outcome is visible without contacting Qwen, Samson, Cloudflare, Vercel, Supabase, or the production chat API

#### Scenario: Deterministic repository verification runs
- **WHEN** static semantic evaluation verification executes without Samson
- **THEN** every case is unique, complete, sanitized, schema-valid, catalog-current, and either compiles safely or declares a deterministic clarification, refusal, grounding rubric, or bounded end-to-end property

#### Scenario: Review artifact drifts from the suite
- **WHEN** the committed human-readable inventory does not exactly match deterministic generation from the structured cases
- **THEN** repository verification fails before any live evaluation is considered

#### Scenario: Live evaluation has not been approved
- **WHEN** the new corpus or requested execution tier has not received explicit human approval
- **THEN** normal repository commands do not send any case to a model, gateway, database, or production API

#### Scenario: AI contract changes
- **WHEN** a release changes any pinned semantic planning or answer contract
- **THEN** the exact candidate is evaluated against the approved tier on the pinned local Qwen model and release is blocked without a passing hash-verified receipt

#### Scenario: Full-path canary cases run
- **WHEN** a reviewer separately approves end-to-end execution
- **THEN** only bounded read-only questions run and scoring uses provenance, catalog revision, decision class, bounds, ordering, null behavior, and other non-sensitive structural properties rather than committed private result values

#### Scenario: Approved extended evaluation completes
- **WHEN** the reviewer approves the extended tier, end-to-end coverage, and repetition count
- **THEN** the exact exported suite, prompts, schemas, catalog, compiler policy, model artifact, and runtime are hash-bound in sanitized receipts containing per-case outcomes and aggregate latency without raw production result rows or credentials
