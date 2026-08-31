# semantic-analytics-query Specification

## Purpose
Define the approved semantic catalog, typed model-plan contract, deterministic
SQL compiler, authorization-preserving analytics role, resource limits, and
privacy-preserving audit evidence for private data chat.

## Requirements

### Requirement: Analytics uses a versioned approved semantic catalog
The system SHALL define each queryable dataset, dataset grain, metric, dimension, record field, filter, operator, join capability, sort, alias, value type, unit, null meaning, value-domain policy, relationship, sensitivity, provenance, and freshness rule in a versioned server-owned catalog. The catalog revision SHALL be checksum-bound, and model plans, compilation, provenance, deterministic fixtures, and release evidence MUST agree on that exact revision. The pilot MUST query only the approved current primary people-groups projection and MUST NOT expose arbitrary uploaded columns or automatically expose a field merely because it exists in mutable field-definition metadata.

#### Scenario: Supported people-groups concept is requested
- **WHEN** a query plan names an approved catalog concept and exact active catalog revision
- **THEN** the system resolves it to the exact versioned dataset and trusted database expression

#### Scenario: Unknown concept, dataset, or stale catalog is requested
- **WHEN** a plan contains an identifier absent from the active catalog revision or echoes a different catalog revision
- **THEN** the system rejects the plan before SQL compilation or database access

#### Scenario: Mutable metadata adds a field
- **WHEN** a field definition, uploaded column, or source contract exists outside the approved catalog allowlist
- **THEN** it is not exposed to Qwen and cannot be queried until a reviewed catalog revision explicitly admits it

### Requirement: Qwen returns structured plans rather than SQL
The system SHALL constrain model planning to a strict schema containing a decision, exact catalog revision, and typed catalog values. The planner SHALL receive a compact catalog-derived context containing approved business meanings, aliases, types, units, null behavior, value-domain policy, metric formulas, and compatibility rules. Model input and output MUST NOT contain executable SQL, physical relation or column names, SQL fragments, database credentials, authorization scope, unrestricted database values, or arbitrary tools.

#### Scenario: Valid query plan is returned
- **WHEN** Qwen selects approved metrics, dimensions, filters, sorting, and limit using the required schema and active catalog revision
- **THEN** the server validates the plan, resolves controlled values, and passes it to the deterministic compiler

#### Scenario: Model returns malformed, stale, or forbidden content
- **WHEN** Qwen returns invalid JSON, a stale catalog revision, an unsupported field, SQL text, or a value outside the typed schema
- **THEN** the system fails closed and permits at most one bounded repair or clarification

#### Scenario: Planner needs semantic meaning
- **WHEN** Qwen interprets an approved business question
- **THEN** it can distinguish the approved concepts from their catalog definitions and aliases without seeing compiler-only mappings or raw database values

### Requirement: SQL compilation is deterministic and parameterized
The system SHALL compile validated, catalog-version-bound plans using only trusted identifier mappings and MUST supply every user/model value as an out-of-line positional parameter. The compiler SHALL enforce one read-only `SELECT`, bounded approved aggregations and sorts, no joins for the single-dataset pilot, and a maximum result limit. Controlled value aliases SHALL be resolved deterministically against an approved active reference resource before compilation; ambiguous aliases MUST clarify without querying, while unknown values SHALL remain complete inert parameters that may produce an empty result.

#### Scenario: Filter contains adversarial text
- **WHEN** a filter value contains quotes, comments, SQL keywords, Unicode, statement delimiters, or prompt instructions
- **THEN** the SQL template remains unchanged and the complete value is supplied only as a parameter

#### Scenario: Country alias has one approved match
- **WHEN** a country filter exactly matches one active approved name, alias, or code under the declared normalization policy
- **THEN** the compiler receives the canonical country display name and reference-resource lineage without exposing the reference payload to Qwen

#### Scenario: Country alias is ambiguous
- **WHEN** a normalized country filter matches more than one active approved country entry
- **THEN** the system asks which country was intended and performs no database query

#### Scenario: Country value is unknown
- **WHEN** a country filter has no active approved alias match
- **THEN** the full value remains an inert parameter and the valid bounded query may return zero rows

#### Scenario: Plan exceeds policy limits
- **WHEN** a plan exceeds approved dimensions, filters, joins, sorts, or result limits
- **THEN** compilation fails before database access

### Requirement: Semantic metadata reuses trusted Accelerate Global vocabulary without widening access
The system SHALL associate approved catalog entries with existing canonical field-definition keys, source-contract fields and versions, or versioned reference-resource keys where applicable. A reviewed catalog overlay SHALL remain authoritative for queryability, metric formulas, units, null semantics, sensitivity, and allowed operations. Runtime mutable metadata MUST NOT directly alter prompts, schemas, compiler mappings, or authorization.

#### Scenario: Source metadata agrees with the catalog
- **WHEN** a catalog field cites an existing source-contract field or canonical field-definition key
- **THEN** automated reconciliation verifies compatible identity and type while retaining the catalog allowlist

#### Scenario: Source metadata drifts
- **WHEN** a cited contract field disappears or its type becomes incompatible
- **THEN** deterministic verification fails and the catalog cannot be released silently

### Requirement: Semantic regression evaluation is release-blocking
The system SHALL maintain a sanitized, versioned capability-evaluation suite covering supported, ambiguous, unsupported, adversarial, multi-turn, controlled-value alias, null/boundary, authorization, prompt-injection, grounded-answer, and end-to-end read-only behavior. The suite SHALL preserve a compact compatibility baseline and SHALL provide cumulative smoke, core, and extended execution tiers. Every case MUST identify its capability, risk, inputs, expected semantic outcome, and deterministic scoring rubric. Golden query decisions MUST validate against the active schema and catalog revision and MUST compile to the expected selected concepts and positional parameters.

The system SHALL generate a deterministic human-readable review inventory containing every proposed prompt, conversation turn, synthetic fixture, expected decision, and rubric. Review generation and static validation MUST perform no model, gateway, network, production API, or database call. Live execution MUST remain a separate explicit operation and MUST NOT occur before the proposed corpus and execution tier receive human approval. A prompt, schema, catalog, compiler-policy, model, runtime, or fixture change MUST produce a fresh pinned live-Qwen receipt before release.

#### Scenario: Reviewer inspects the proposed corpus
- **WHEN** the review inventory is generated from the versioned suite
- **THEN** every expanded case and expected outcome is visible without contacting Qwen, Samson, Cloudflare, Vercel, Supabase, or the production chat API

#### Scenario: Deterministic repository verification runs
- **WHEN** the semantic evaluation suite executes without Samson
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

### Requirement: Query execution preserves authorization and least privilege
The system SHALL execute admitted queries through a dedicated non-bypass read-only role over an approved security-invoker analytical view while propagating the server-verified user identity and trusted workspace role transaction-locally. The view SHALL use a locked-search-path, no-argument projection entrypoint that independently verifies `auth.uid()` and the trusted pilot role. The analytics role MUST NOT receive direct public/auth table privileges, and the resulting dataset-access outcome MUST remain at least as restrictive as the existing pilot authorization rules.

#### Scenario: User may access the source dataset
- **WHEN** the verified identity is authorized by existing dataset visibility and RLS rules
- **THEN** the broker may return only rows visible to that identity

#### Scenario: User may not access the source dataset
- **WHEN** the source dataset is restricted from the verified identity
- **THEN** the database returns no unauthorized rows and the broker cannot bypass the restriction

#### Scenario: Broker role attempts a write or unauthorized relation
- **WHEN** the analytics credential attempts DML, DDL, an unsafe function, or a non-approved relation
- **THEN** PostgreSQL rejects the operation through grants, read-only transaction settings, or admission policy

### Requirement: Query execution is resource-bounded
The system SHALL enforce statement, lock, idle-transaction, work-memory, estimated-cost, row-count, response-byte, connection, and concurrency limits. All parse, policy, timeout, and limit errors MUST fail closed.

#### Scenario: Query exceeds cost or time budget
- **WHEN** an admitted template has excessive estimated cost or exceeds the execution deadline
- **THEN** the broker cancels or rejects it and returns no partial rows as a complete result

#### Scenario: Result exceeds row or byte limit
- **WHEN** execution produces more than the permitted rows or serialized bytes
- **THEN** the broker rejects the result or reports it as truncated only through an explicit bounded contract

### Requirement: Analytics audit evidence excludes sensitive content
The system SHALL record query identifier, pseudonymous identity/session reference, policy/catalog/model/runtime hashes, decision, stable reason, referenced view, parameterized redacted template, timing, row count, and byte count. It MUST NOT store raw prompts, parameter values, result rows, provider credentials, or raw provider errors.

#### Scenario: Query completes or fails
- **WHEN** the broker reaches an admission or execution decision
- **THEN** it appends a redacted audit event sufficient to reproduce policy and performance without retaining sensitive content
