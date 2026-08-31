## ADDED Requirements

### Requirement: Semantic context is built as a reviewed immutable snapshot
The system SHALL build a versioned semantic-context snapshot from approved query-catalog metadata, canonical field definitions, source contracts, source mappings, named-filter definitions, pipeline semantic contracts, filter-region definitions, and active reference-resource summaries. Each snapshot MUST include a canonical checksum, schema version, exact source-version manifest, validation findings, and conflict findings, and MUST NOT become active without explicit review and activation.

#### Scenario: Candidate snapshot is valid and reviewed
- **WHEN** all required source identities and versions reconcile and a reviewer activates the candidate
- **THEN** the immutable checksum-bound snapshot becomes eligible for runtime retrieval

#### Scenario: Source definition conflicts with an approved semantic meaning
- **WHEN** candidate construction finds contradictory type, boolean direction, unit, null meaning, formula, or definition evidence
- **THEN** the affected entry is excluded from planner/answer context or requires an explicit reviewed overlay before activation

#### Scenario: Mutable metadata changes after activation
- **WHEN** a field definition, source mapping, filter, pipeline contract, or resource pointer changes
- **THEN** the active snapshot remains unchanged until a new candidate is built, reviewed, and activated

### Requirement: Every semantic entry declares authority and audience
Each semantic entry SHALL declare a stable concept key, kind, dataset scope, label, approved definition, aliases, type/unit/null metadata where applicable, exact source lineage, sensitivity, retrieval tags, permitted planner/answer audiences, and one authority classification of `queryable`, `explanatory-only`, `resolver-only`, or `excluded`.

#### Scenario: Retrieved entry is explanatory-only
- **WHEN** an explanatory definition is relevant to a question
- **THEN** Qwen may use it to explain the concept but cannot place its key in a typed query plan unless the independent query catalog already permits it

#### Scenario: Entry is excluded or audience-incompatible
- **WHEN** an entry is excluded, too sensitive, outside the dataset scope, or unavailable to the current model stage
- **THEN** it is not serialized into model context

### Requirement: Retrieval is deterministic, bounded, and lightweight
The system SHALL rank eligible semantic entries using deterministic exact-key/alias matching followed by deterministic lexical relevance, SHALL use a stable tie-break, and SHALL enforce configured entry and byte limits. The initial production implementation MUST run locally in the application process and MUST NOT require an external vector database or an additional model call.

#### Scenario: Exact alias and broader lexical matches coexist
- **WHEN** one entry exactly matches a normalized alias and others only share descriptive terms
- **THEN** the exact alias ranks first and repeated execution produces the same ordered result

#### Scenario: Candidate context exceeds the budget
- **WHEN** relevant entries would exceed six entries or 8 KiB of serialized context
- **THEN** the retriever applies stable truncation and records the bounded retrieval outcome without exceeding the model contract

#### Scenario: Snapshot is cached
- **WHEN** multiple requests use the same active snapshot checksum
- **THEN** the application reuses an immutable in-process index while still detecting an active-pointer change within the configured refresh interval

### Requirement: Retrieved content cannot act as instructions or authority
The system SHALL serialize retrieved context only through a strict data schema and SHALL treat every definition, alias, source label, and resource summary as untrusted content. Retrieved text MUST NOT alter system instructions, permissions, queryability, tools, SQL mappings, credentials, or authorization scope.

#### Scenario: Definition contains instruction-like or SQL-like text
- **WHEN** candidate content contains prompt instructions, executable-looking text, unsupported markup, control characters, or an oversized value
- **THEN** snapshot validation rejects or safely excludes the entry and no instruction reaches Qwen as authority

#### Scenario: Retrieved entry names an unapproved field or join
- **WHEN** the retriever selects an explanatory entry outside the query allowlist
- **THEN** the typed plan schema and deterministic compiler continue to reject that field or join

### Requirement: Large resources remain behind deterministic resolvers
The system SHALL provide Qwen only with reviewed summaries and supported-operation metadata for large country, ROP, PEID, PeopleID3, source-alias, merge-priority, and engagement-mapping resources. Exact entries MUST remain behind typed server-side resolvers with active-version lineage and MUST NOT be bulk-injected into prompts.

#### Scenario: User supplies an approved country alias
- **WHEN** a query includes a country name or code
- **THEN** deterministic resolution uses the active country resource and the model does not receive the full country payload

#### Scenario: User asks about a resolver-only crosswalk
- **WHEN** the current query catalog has no approved crosswalk filter or join
- **THEN** Qwen may explain the resource's reviewed purpose but cannot query or traverse its entries

### Requirement: Retrieval failures and staleness fail safely
The system SHALL bind retrieval to the active snapshot version/checksum and exact cited source versions. When required context is missing, unhealthy, stale, or fails validation, the system MUST return a bounded retryable semantic-context failure or use only the core catalog when the request does not require retrieved knowledge.

#### Scenario: Definition-only question requires an unavailable snapshot
- **WHEN** the active semantic snapshot cannot be loaded or validated
- **THEN** the answer fails closed without substituting model world knowledge

#### Scenario: Data query needs only the core query catalog
- **WHEN** the snapshot is unavailable but the question is fully representable by the existing core catalog and no named/view context depends on it
- **THEN** the server may execute the current safe typed-plan path without retrieved context

### Requirement: Retrieval lineage is auditable without retaining sensitive content
The system SHALL record the semantic snapshot checksum, retriever policy version, selected semantic entry keys/checksums, context token hash where applicable, model-stage audience, latency, and bounded outcome. It MUST NOT store raw prompts, raw active-filter values, full retrieved payloads, result rows, credentials, or raw provider errors.

#### Scenario: Retrieval supports a plan or definition answer
- **WHEN** semantic context is selected
- **THEN** redacted evidence is sufficient to reproduce the snapshot and ranking policy without exposing the user's question or private data values

### Requirement: Retrieval quality is release-tested
The system SHALL maintain deterministic exact, alias, lexical, conflict, exclusion, injection, sensitivity, scope, stale-version, and context-budget cases, plus approved live-Qwen cases for definition and planning behavior. Retrieval-policy or snapshot-schema changes MUST produce new hash-bound release evidence.

#### Scenario: Retriever ranking changes
- **WHEN** tokenization, scoring, aliases, eligibility rules, context limits, or snapshot content changes
- **THEN** regression tests and the approved live evaluation tier must pass before production activation
