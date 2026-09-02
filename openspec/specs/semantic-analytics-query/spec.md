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

### Requirement: Named filters have one authoritative executable definition
The system SHALL maintain each approved named filter as a versioned typed expression owned by application code and SHALL use that same definition for table-row evaluation, trusted current-view context, semantic explanation, typed plans, and deterministic SQL compilation. Qwen MUST reference only an approved named-filter key and validated options and MUST NOT generate arbitrary boolean expression trees.

#### Scenario: UUPG uses its default active criteria
- **WHEN** the UUPG named filter enables global-engagement and frontier-group criteria
- **THEN** both table and SQL execution apply `(global engagement is false or blank) AND (frontier group is true or blank)` exactly

#### Scenario: UUPG blank behavior is explained
- **WHEN** the filter is rendered or supplied as semantic context
- **THEN** it explains that blank values are retained because they do not record the disqualifying opposite state, identifies the view as null-preserving, and does not claim that a blank is an affirmative classification or the same rule as the Baseline UUPG pipeline

#### Scenario: One UUPG criterion is disabled
- **WHEN** validated current-view state disables one supported UUPG criterion
- **THEN** table evaluation, planner context, description, and SQL compilation apply only the remaining active branch

#### Scenario: Table and compiler evaluate the same fixture
- **WHEN** explicit true/false and blank combinations are evaluated through both implementations
- **THEN** the matching record identities and counts are identical

#### Scenario: Plan names an unknown or stale filter
- **WHEN** a plan or view context cites an unknown named-filter key, invalid option, or stale registry checksum
- **THEN** validation fails before database access

### Requirement: Reviewed ROP classification fields are typed analytics concepts
The approved primary people-group analytics projection SHALL expose a normalized six-digit `rop3_code` and the query catalog SHALL expose reviewed semantic concepts for ROP1, ROP2, ROP25, and ROP3 code/name plus ROP3 status, place, language, source, and join/match status. Approved hierarchy code/name concepts MAY be selected, filtered, grouped, and sorted through the typed plan. User-supplied ROP names/codes MUST be deterministically resolved to canonical values before parameterized compilation. ROP descriptions SHALL remain explanatory/resource-detail evidence unless separately promoted as typed query concepts.

#### Scenario: User filters by a ROP hierarchy term
- **WHEN** a user asks for people groups in an approved ROP1, ROP2, ROP25, or ROP3 classification using a canonical code or unambiguous name
- **THEN** deterministic resolution supplies the canonical code and the compiler emits only the registered parameterized predicate

#### Scenario: User groups by a reviewed ROP level
- **WHEN** a typed plan selects an approved ROP hierarchy code/name as its grouping dimension
- **THEN** execution preserves the primary people-group grain before grouping and returns the reviewed label/code with typed completeness and evidence metadata

#### Scenario: ROP name is ambiguous
- **WHEN** deterministic resolution finds multiple permitted canonical terms for the supplied name
- **THEN** no analytics query executes until the user selects from a bounded ambiguity response

#### Scenario: Plan cites an unreviewed ROP attribute
- **WHEN** a plan requests a source column, description, or attribute absent from the query catalog
- **THEN** validation rejects it before compilation even when a retrieved resource entry contains that attribute

### Requirement: ROP relationships are registered, version-bound, grain-safe, and null-preserving
Combining primary people-group data with ROP SHALL use only the server-owned `people_group_to_bound_rop3` relationship. The relationship registry MUST own its physical projection, normalized key mapping, selected columns, many-to-one cardinality, and deterministic left-relationship compilation. Execution MUST resolve the exact immutable `rop-codes` version bound to the dataset producer/forming run through its reference-resource set. For an independently reviewed dataset version that predates publication lineage, execution MAY instead use one exact private append-only legacy binding to a complete valid ROP version, but only when no producer publication exists for that dataset. Runtime resolution MUST never derive that legacy binding from the active pointer and MUST fail closed if neither binding can be proven. Qwen MUST NOT emit physical tables, join keys, join types, or `ON` expressions.

#### Scenario: Dataset has an immutable ROP resource binding
- **WHEN** an approved ROP concept is selected for a primary dataset whose production lineage resolves one exact ROP version
- **THEN** the compiler uses `people_group_to_bound_rop3` with that version and does not consult the current active ROP pointer

#### Scenario: Reviewed pre-publication dataset has an explicit legacy binding
- **WHEN** the exact current dataset version predates publication lineage and a private append-only review record pins one complete valid ROP version
- **THEN** the compiler uses that exact version without consulting or mutating the active pointer, and the legacy binding exposes no direct application, provider, or analytics-role grants

#### Scenario: Producer publication supersedes a legacy path
- **WHEN** producer publication exists for a dataset that also has a historical legacy binding record
- **THEN** resolution uses only producer resource-set lineage and does not fall back to the legacy record

#### Scenario: Active ROP version has advanced
- **WHEN** standalone browsing uses a newer active ROP version than the version bound to the dataset
- **THEN** standalone results label the active version while dataset filters/relationships continue to use the immutable bound version

#### Scenario: Dataset ROP binding is absent or ambiguous
- **WHEN** producer/forming-run lineage cannot prove one exact ROP resource version and no eligible exact reviewed legacy binding exists
- **THEN** ROP analytics fails closed with a bounded explanation and no relationship or fallback-to-active-version query executes

#### Scenario: Dataset ROP3 is blank, malformed, inactive, or unmatched
- **WHEN** an unfiltered result uses the registered ROP relationship
- **THEN** the base people-group row remains present, its classification values remain null as appropriate, and typed match/join status explains the condition without Qwen inventing a replacement

#### Scenario: User explicitly filters on a ROP classification
- **WHEN** an approved ROP predicate is applied
- **THEN** nonmatching or null-classification rows are excluded only according to that stated predicate and the answer identifies the resulting filter scope

#### Scenario: User filters primary data by ROP geography
- **WHEN** an approved geography predicate is requested
- **THEN** the compiler uses a registered `EXISTS`-style predicate against the bound ROP version so the people-group grain and counts are not multiplied

#### Scenario: User names a country in a ROP geography filter
- **WHEN** the value is not an exact stored ROP geography value but uniquely matches a reviewed country name or alias
- **THEN** deterministic application code resolves it to a canonical country code present in the reviewed ROP resource, records both resource versions, and compiles only the parameterized grain-preserving predicate

#### Scenario: User requests ROP geography rows
- **WHEN** the request requires listing one-to-many ROP3 geography records
- **THEN** execution returns the dedicated `rop_geography` result grain rather than flattening geography rows into a people-group aggregate

#### Scenario: Model proposes a join expression or unregistered relationship
- **WHEN** model output includes physical keys, an `ON` condition, direct geography flattening, or a relationship key absent from the active registry
- **THEN** schema validation or compilation rejects it before database access

### Requirement: Record query results declare completeness and matching scope
Every executed record query SHALL return its query mode, requested limit, returned count, matching count, `hasMore` status, selected concepts, applied named-filter keys, dataset/version identity, and bounded rows. Internal matching-count fields MUST be removed before rows are exposed to Qwen or the browser.

#### Scenario: More records match than the approved limit
- **WHEN** 103 records match and the requested/approved limit is 100
- **THEN** the result reports `matchedCount=103`, `returnedCount=100`, and `hasMore=true`

#### Scenario: All matching records fit within the limit
- **WHEN** the matching count is less than or equal to the requested limit
- **THEN** the result reports the exact matching and returned counts with `hasMore=false`

#### Scenario: Completeness values disagree
- **WHEN** returned count exceeds the limit, matching count is smaller than returned count, or `hasMore` conflicts with the counts
- **THEN** the broker rejects the result and emits no complete answer

### Requirement: Numeric claims are bound to typed evidence and scope
The system SHALL construct a typed evidence ledger from validated aggregate cells, record cells, matching/returned counts, units, null meanings, and query scope. User-visible numeric facts MUST be rendered from validated evidence references rather than model-authored value strings. Unknown, altered, unit-incompatible, or scope-incompatible evidence references MUST trigger deterministic fallback.

#### Scenario: Bounded page is narrated
- **WHEN** a record result returns 100 of 103 matching records
- **THEN** the authoritative response states that 103 match and 100 are shown and MUST NOT state that the total is 100

#### Scenario: Scalar count is narrated
- **WHEN** an aggregate returns `people_group_count=103`
- **THEN** the rendered fact uses exactly 103 people groups with the approved unit

#### Scenario: Qwen changes a value or scope
- **WHEN** Qwen cites returned-count evidence as a matching total or supplies a different literal/unit
- **THEN** the narrative is discarded and the deterministic grounded response is returned

### Requirement: Signed prior-turn evidence supports trustworthy follow-ups
The system SHALL issue bounded signed turn-state evidence for completed plans/results and SHALL verify identity/session binding, expiry, catalog/filter/snapshot versions, result checksum, and evidence scope before using it in a later turn. Client-supplied assistant prose MUST NOT be treated as trusted prior-query evidence.

#### Scenario: User challenges a prior count
- **WHEN** a follow-up asks why a returned page differs from a prior matching count and supplies valid signed turn evidence
- **THEN** the planner/narrator can distinguish prior aggregate totals from record-page bounds without relying on assistant prose

#### Scenario: Client forges prior result text or state
- **WHEN** assistant prose or a turn token claims an unverified count, field, or dataset
- **THEN** the server ignores the untrusted claim or rejects the token and performs no query based on it

### Requirement: Retrieved semantics never widen deterministic query authority
The planner MAY receive relevant reviewed semantic cards, named-filter descriptions, deterministic resolver outputs, typed dependencies, and up to two reviewed semantic-plan examples, but the typed schema, active query catalog, named-filter registry, controlled-value resolvers, and compiler SHALL remain the only sources of executable query authority. Retrieved examples MUST NOT contain SQL or compiler mappings.

#### Scenario: Retrieval explains an unavailable concept
- **WHEN** an explanatory-only entry is relevant but absent from the query catalog
- **THEN** Qwen may explain the concept or limitation but cannot compile it into SQL

#### Scenario: Retrieval suggests a physical field or relationship
- **WHEN** retrieved metadata contains a source column, mapping, or relationship not approved for chat
- **THEN** the plan and compiler reject it before database access

#### Scenario: Retrieved example is stale or over-broad
- **WHEN** an example cites a stale catalog/filter version or a concept/operator unavailable to the current query catalog
- **THEN** it is excluded before planning and cannot authorize that plan shape

### Requirement: Incident regressions are release-blocking
The semantic evaluation suite SHALL cover the exact country-count, frontier-count, capped-record-list, count-challenge, and UUPG-view sequence that produced the 100/103/104 disagreement. It SHALL also cover every explicit/blank UUPG input combination and require table/SQL parity, completeness wording, and deterministic evidence fallback.

#### Scenario: Exact Sudan-style regression fixture runs
- **WHEN** a fixture contains 103 frontier matches, 104 UUPG matches, and a 100-row record limit
- **THEN** aggregate, named-filter, and record-page answers remain distinct and no response promotes 100 returned rows to a total

#### Scenario: Planner or answer contract changes
- **WHEN** result shape, named-filter registry, retrieval policy, evidence schema, prompt, or model changes
- **THEN** the full approved deterministic suite and pinned live-Qwen repetitions must pass before release
