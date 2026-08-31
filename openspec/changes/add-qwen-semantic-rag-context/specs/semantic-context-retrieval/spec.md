## ADDED Requirements

### Requirement: Semantic context is built as a reviewed immutable snapshot
The system SHALL build a versioned semantic-context snapshot from approved query-catalog metadata, canonical field definitions, source contracts, source mappings, named-filter definitions, pipeline semantic contracts, filter-region definitions, active reference-resource summaries, and a separately reviewed semantic-plan demonstration pool. Each snapshot MUST include a canonical checksum, schema version, exact source-version/freshness manifest, card and optional embedding-index manifest, validation findings, and conflict findings, and MUST NOT become active without explicit review and activation.

#### Scenario: Candidate snapshot is valid and reviewed
- **WHEN** all required source identities and versions reconcile and a reviewer activates the candidate
- **THEN** the immutable checksum-bound snapshot becomes eligible for runtime retrieval

#### Scenario: Source definition conflicts with an approved semantic meaning
- **WHEN** candidate construction finds contradictory type, boolean direction, unit, null meaning, formula, or definition evidence
- **THEN** the affected entry is excluded from planner/answer context or requires an explicit reviewed overlay before activation

#### Scenario: Mutable metadata changes after activation
- **WHEN** a field definition, source mapping, filter, pipeline contract, or resource pointer changes
- **THEN** the active snapshot remains unchanged until a new candidate is built, reviewed, and activated

### Requirement: Runtime definitions and guiding documents stay synchronized
The system SHALL represent runtime semantic resources and human guiding documents as synchronized projections of one versioned semantic definition package. A supported change initiated from either representation MUST build one candidate showing both resulting projections, MUST require Blake’s pilot approval for conflicts, and MUST activate or roll back both atomically. Canonical semantic checksum drift, ambiguous document parsing, concurrent conflicts, or attempted authority widening MUST block activation rather than use last-write-wins behavior.

#### Scenario: Structured semantic resource is edited
- **WHEN** a reviewed definition changes through the structured resource workflow
- **THEN** the candidate regenerates the affected guiding-document content and cannot activate unless both representations reconcile

#### Scenario: Guiding document is edited
- **WHEN** a supported definition section changes in a human guiding document
- **THEN** the system parses it into a structured candidate diff, shows any semantic or authority changes for review, and leaves runtime behavior unchanged until activation

#### Scenario: Document and resource edits conflict
- **WHEN** concurrent or ambiguous edits produce different canonical meanings
- **THEN** activation is blocked and Blake selects or writes the reconciled meaning without either side silently overwriting the other

### Requirement: Every semantic entry declares authority and audience
Each semantic card SHALL declare a stable concept key, kind, dataset/grain, label, approved definition, aliases, type/unit/null metadata where applicable, allowed-value or resolver policy, metric/filter formula, typed dependency/relationship edges, any separately approved safe-join capability key, examples/counterexamples, exact source/version/freshness lineage, deterministic contextual search text, sensitivity, retrieval tags, permitted planner/answer audiences, and one authority classification of `queryable`, `explanatory-only`, `resolver-only`, or `excluded`.

#### Scenario: Retrieved entry is explanatory-only
- **WHEN** an explanatory definition is relevant to a question
- **THEN** Qwen may use it to explain the concept but cannot place its key in a typed query plan unless the independent query catalog already permits it

#### Scenario: Entry is excluded or audience-incompatible
- **WHEN** an entry is excluded, too sensitive, outside the dataset scope, or unavailable to the current model stage
- **THEN** it is not serialized into model context

#### Scenario: Contextual search text is generated
- **WHEN** a reviewed card is built
- **THEN** its searchable text is derived deterministically from structured dataset, grain, kind, label, aliases, definition, scope, and version fields and is not authored by an ingestion-time model

### Requirement: Retrieval uses the smallest benchmark-qualified tier
The system SHALL resolve exact keys/aliases before ranked retrieval and SHALL use private PostgreSQL full-text search as the independently qualified baseline. Before production selection it SHALL compare that baseline with Qwen3-Embedding-0.6B plus exact pgvector similarity and reciprocal-rank fusion, and MAY compare Qwen3-Reranker-0.6B over a bounded fused candidate set. It MUST select the smallest tier that passes all critical, material-gain, latency, and Samson-capacity gates and MUST NOT require a hosted vector database or approximate vector index.

#### Scenario: Exact alias and broader lexical matches coexist
- **WHEN** one entry exactly matches a normalized alias and others only share descriptive terms
- **THEN** the exact alias ranks first and repeated execution produces the same ordered result

#### Scenario: Dense retrieval does not materially improve the holdout
- **WHEN** hybrid retrieval fails the predeclared material-gain or resource gates
- **THEN** production uses the exact/full-text tier and the dense sidecar/index is not deployed

#### Scenario: Hybrid retrieval qualifies
- **WHEN** hybrid retrieval passes every critical gate, materially improves the sealed holdout, and stays within the approved resource envelope
- **THEN** production may use snapshot-bound Qwen3 embeddings, exact pgvector search, and reciprocal-rank fusion while exact aliases retain precedence

#### Scenario: Reranking adds no further material value
- **WHEN** the reranker fails its additional material-gain or latency gate
- **THEN** production omits the reranker even when hybrid retrieval qualifies

#### Scenario: Candidate context exceeds the budget
- **WHEN** relevant entries would exceed six entries or 8 KiB of serialized context
- **THEN** the assembler preserves pinned exact/current-view evidence and required dependencies, applies stable coverage-aware truncation, and records the bounded outcome without exceeding the model contract

#### Scenario: Snapshot is cached
- **WHEN** multiple requests use the same active snapshot checksum
- **THEN** the application reuses the immutable exact map and snapshot/index manifest while still detecting an active-pointer change within the configured refresh interval

### Requirement: Context assembly uses verified query views and typed coverage
The system SHALL construct retrieval views from the original user utterance plus only verified current-view and prior-turn concept/evidence keys, SHALL expand reviewed typed dependencies required for semantic completeness, and SHALL select a minimal set by required-evidence coverage before optional similarity support. Client assistant prose and unsigned state MUST NOT rewrite retrieval.

#### Scenario: Follow-up uses a pronoun
- **WHEN** a user asks “show those” with valid signed prior-turn concept/result state
- **THEN** retrieval may add those verified concept keys while retaining the original utterance

#### Scenario: Client forges prior context
- **WHEN** unsigned prose claims a concept, filter, count, or dataset
- **THEN** it does not contribute a retrieval key, dependency, or authority

#### Scenario: Named filter requires dependent definitions
- **WHEN** UUPG is pinned by exact wording or signed current-view context
- **THEN** context assembly includes the active UUPG criteria and required global-engagement/frontier semantic cards before unrelated similarity matches

#### Scenario: Required evidence is incomplete or conflicting
- **WHEN** the assembler cannot fit, validate, or reconcile all required semantic dependencies
- **THEN** it asks a bounded clarification or fails closed instead of adding broader context

### Requirement: Retrieved planning examples are reviewed and isolated from evaluation
The planner MAY receive no more than two snapshot-bound examples containing a sanitized question pattern, relevant concept/filter keys, and an exact typed semantic plan. Examples MUST NOT contain SQL, compiler mappings, result rows, production conversation text, or evaluation-holdout equivalents. Intent and plan skeletons MUST be grouped and deduplicated before demonstration and holdout assignment.

#### Scenario: Relevant reviewed example exists
- **WHEN** an example matches the question intent and current catalog/filter versions
- **THEN** it may consume one retrieval slot and be serialized as non-authoritative plan guidance

#### Scenario: Example overlaps the sealed holdout
- **WHEN** an example is identical to or a paraphrase/plan-skeleton duplicate of a held-out case
- **THEN** candidate validation excludes it from the demonstration pool

### Requirement: Retrieved content cannot act as instructions or authority
The system SHALL serialize retrieved context only through a strict data schema and SHALL treat every definition, alias, source label, example, and resource summary as untrusted content. Permission, dataset, audience, sensitivity, authority, deletion/expiry, and snapshot filters MUST be enforced before lexical/vector ranking. Retrieved text MUST NOT alter system instructions, permissions, queryability, tools, SQL mappings, credentials, or authorization scope.

#### Scenario: Definition contains instruction-like or SQL-like text
- **WHEN** candidate content contains prompt instructions, executable-looking text, unsupported markup, control characters, or an oversized value
- **THEN** snapshot validation rejects or safely excludes the entry and no instruction reaches Qwen as authority

#### Scenario: Retrieved entry names an unapproved field or join
- **WHEN** the retriever selects an explanatory entry outside the query allowlist
- **THEN** the typed plan schema and deterministic compiler continue to reject that field or join

#### Scenario: Restricted card would be semantically similar
- **WHEN** a card is outside the authenticated audience or dataset scope
- **THEN** it is excluded before ranking and neither its content nor similarity score reaches the application/model

#### Scenario: Embedding index is stale or inconsistent
- **WHEN** card checksum, embedding model/revision, instruction, dimension, or index manifest does not match the active snapshot
- **THEN** dense retrieval is unavailable and the request uses only the qualified lexical fallback when its coverage policy permits

#### Scenario: Retrieved content attempts prompt injection
- **WHEN** a reviewed-source candidate includes hidden Unicode, instruction-like strings, oversized text, or poisoning-shaped broad similarity
- **THEN** validation/quarantine and adversarial tests prevent it from influencing Qwen as instructions or authority

### Requirement: Large resources remain behind deterministic resolvers
The system SHALL provide Qwen only with reviewed summaries, value-domain policy, and supported-operation metadata for large country, ROP, PEID, PeopleID3, source-alias, merge-priority, and engagement-mapping resources. Exact entries MUST remain behind typed server-side resolvers with active-version lineage, SHOULD be resolved before planning when an approved domain is relevant, and MUST NOT be bulk-injected into retriever indexes or prompts.

#### Scenario: User supplies an approved country alias
- **WHEN** a query includes a country name or code
- **THEN** deterministic resolution uses the active country resource, supplies only canonical match/ambiguity state, and the model does not receive the full country payload

#### Scenario: User asks about a resolver-only crosswalk
- **WHEN** the current query catalog has no approved crosswalk filter or join
- **THEN** Qwen may explain the resource's reviewed purpose but cannot query or traverse its entries

#### Scenario: User requests an exact ROP definition or code
- **WHEN** the question maps to the approved phase-one ROP definition/code resolver
- **THEN** deterministic resolution returns only the canonical exact match or bounded ambiguity state with active-version lineage

#### Scenario: User requests bulk ROP browsing or an unapproved data operation
- **WHEN** the user asks Qwen to enumerate the ROP catalog, filter people-group data by an unapproved ROP field, or join ROP entries to data through model-selected keys
- **THEN** the request is declined or redirected to a separately approved named capability and no catalog traversal, filter, or join executes

### Requirement: Retrieval failures and staleness fail safely
The system SHALL bind retrieval to the active snapshot version/checksum and exact cited source versions. When required context is missing, unhealthy, stale, or fails validation, the system MUST return a bounded retryable semantic-context failure or use only the core catalog when the request does not require retrieved knowledge.

#### Scenario: Definition-only question requires an unavailable snapshot
- **WHEN** the active semantic snapshot cannot be loaded or validated
- **THEN** the answer fails closed without substituting model world knowledge

#### Scenario: Data query needs only the core query catalog
- **WHEN** the snapshot is unavailable but the question is fully representable by the existing core catalog and no named/view context depends on it
- **THEN** the server may execute the current safe typed-plan path without retrieved context

### Requirement: Retrieval lineage is auditable without retaining sensitive content
The system SHALL record the semantic snapshot/index checksum, retriever policy/order version, selected card/example keys and checksums, resolver/resource versions, lexical/hybrid/rerank tier, embedding/rerank artifact/instruction identity when used, context token hash where applicable, model-stage audience, latency, and bounded outcome. It MUST NOT store raw prompts, raw active-filter values, full retrieved payloads, result rows, credentials, or raw provider errors. Internal lineage MUST remain reproducible even when no user-facing provenance panel is rendered.

#### Scenario: Retrieval supports a plan or definition answer
- **WHEN** semantic context is selected
- **THEN** redacted evidence is sufficient to reproduce the snapshot and ranking policy without exposing the user's question or private data values

### Requirement: Retrieval quality is independently release-tested
The system SHALL maintain a human-reviewed, grouped, deduplicated train/dev/holdout relevance corpus covering exact keys/aliases, paraphrases, multi-concept questions, multi-turn state, typed dependencies, examples, ambiguity, hard negatives, conflicts, exclusion, injection, sensitivity, scope, stale versions, failures, and context budgets. It SHALL gate retrieval separately from typed planning, SQL/result execution, evidence-claim precision, answer faithfulness, clarification/abstention, and off-topic refusal. Automated RAG judges MAY be diagnostic only and MUST be calibrated against human labels rather than serving as the sole release gate.

#### Scenario: Retriever ranking changes
- **WHEN** tokenization, scoring/fusion, aliases, eligibility/dependency rules, prompt ordering, examples, model artifacts/instructions, context limits, or snapshot content changes
- **THEN** regression tests and the approved live evaluation tier must pass before production activation

#### Scenario: Retrieval tier is promoted
- **WHEN** a candidate tier is considered for production
- **THEN** critical exact/resolver cases have 100% Recall@1, release-blocking multi-concept cases have 100% required-set coverage, held-out paraphrases have at least 95% Recall@6, no excluded/cross-audience/critical-hard-negative card is emitted, and every approved latency/capacity gate passes

#### Scenario: Denser tier is more complex but not materially better
- **WHEN** hybrid or reranked retrieval fails to improve held-out Recall@6 or nDCG@6 by three absolute points and fails to fix at least three predeclared material misses
- **THEN** the system retains the lighter qualified tier
