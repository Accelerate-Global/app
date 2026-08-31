## Why

Private Qwen currently receives a small static semantic catalog but no validated dataset-view context and no on-demand access to the broader field, filter, source-contract, pipeline, and reference-resource knowledge already maintained by Accelerate Global. The production 100-versus-103-versus-104 incident also showed that a bounded record page can be mistaken for a total and that the table and chat paths can apply different semantic predicates.

## What Changes

- Add a lightweight, versioned semantic-context retrieval layer over reviewed Accelerate Global metadata. Exact keys and aliases always win; a pre-implementation bakeoff will choose the smallest production retrieval tier that passes the domain corpus: PostgreSQL full-text search, full-text plus local Qwen3 embeddings fused with reciprocal-rank fusion, or that hybrid path plus a bounded local Qwen3 reranker.
- Represent reviewed metadata as contextual semantic cards with typed dependency edges. Assemble a minimal coverage set for each question instead of ranking isolated chunks or dumping the full metadata corpus into the prompt.
- Add controlled multi-turn retrieval rewriting from signed current-view and prior-turn concept state, deterministic resolution of approved value domains, and at most two separately reviewed question-to-semantic-plan examples.
- Keep the query catalog and relationship registry as the sole queryability allowlists. Retrieved metadata may explain approved concepts but MUST NOT automatically expose fields, joins, values, or tools; this release deliberately adds reviewed ROP operations, fields, and relationships through those independent allowlists.
- Add complete governed conversational access to the ROP resource: authenticated users may search, list, count, inspect, and cursor-page through the complete permitted ROP version; filter primary people-group data by reviewed ROP hierarchy/classification fields; and use registered server-owned ROP relationships without Qwen choosing physical tables, keys, or join conditions.
- Establish one shared named-filter registry used by the dataset table, current-view context, planner contract, and SQL compiler. The existing UUPG filter behavior—including enabled criteria and blank-value matching—is authoritative.
- Add an authenticated **Ask Qwen about this view** handoff from the approved primary dataset, with a short-lived server-signed context containing the exact dataset version and active filters.
- Display current-view filter chips and quick-reference prompts in chat while allowing the user to clear the context.
- Extend the typed plan with approved named filters and extend query results with mode, requested limit, returned count, matching count, and completeness (`hasMore`).
- Prevent Qwen from describing a bounded record page as a total. Numeric fact bullets and count/list scope SHALL be produced or validated deterministically, with a deterministic fallback on disagreement.
- Promote curated dataset grain, field definitions, aliases, types, units, null semantics, allowed-value/resolver policy, metric formulas, relationship/dependency and resource-operation metadata, source lineage/freshness, pipeline/filter definitions, and reference-resource summaries into a checksum-bound semantic-context snapshot after conflict review.
- Keep runtime semantic resources and human guiding documents as synchronized projections of the same reviewed definition package. A change initiated from either side MUST create one review candidate that updates both, fails on drift, and requires Blake’s pilot approval before activation; no automatic last-write-wins overwrite is allowed.
- Benchmark retrieval independently from planning and narration using human-reviewed relevance sets, exact/alias gates, Recall@k, nDCG@k, set coverage, hard-negative rate, clarification/abstention behavior, latency, and Samson resource contention. Automated LLM judges are secondary diagnostics, never the sole release gate.
- Add regression, parity, retrieval, security, grounding, and end-to-end tests, including the exact Sudan UUPG/frontier and 100-row-limit incident.
- **Non-goals:** Qwen will not receive database credentials, generate executable SQL, query arbitrary uploaded columns, bulk-inject complete resource payloads into a model prompt, choose physical join keys/conditions, execute exploratory SQL probes, use web fallback, persist raw conversation history, or replace the deterministic compiler and read-only analytics role. GraphRAG, RAPTOR-style hierarchical summarization, autonomous/agentic RAG, model-generated runtime examples, and an external hosted vector service are outside this release.

## Capabilities

### New Capabilities

- `semantic-context-retrieval`: Versioned, reviewed, permission-aware retrieval of relevant business definitions, relationship semantics, resource summaries, and operation metadata for Qwen planning and narration without widening query authority.

### Modified Capabilities

- `semantic-analytics-query`: Add shared named-filter semantics, result-completeness metadata, deterministic numeric-claim enforcement, and retrieval lineage while retaining typed plans and deterministic parameterized SQL.
- `private-data-chat`: Add validated current-view handoff, filter quick references, context lifecycle, and grounded responses that distinguish matching totals from returned pages.
- `rop-code-resource`: Reuse the complete authenticated ROP search/detail/download projection for bounded conversational browsing and add dataset-version-bound relational use without changing ROP lifecycle authority.

## Impact

- Chat planning, orchestration, gateway contracts, schemas, compiler, broker, audit evidence, and evaluation suites under `src/lib/private-data-chat/` and `src/app/api/chat/`.
- Dataset filter definitions and table state under `src/lib/dataset-filtering.ts` and `src/components/dashboard/`.
- A new server-owned semantic-context builder/retriever sourced from field definitions, source contracts, pipeline semantic contracts, named filters, reviewed semantic-plan examples, and active reference-resource metadata.
- A typed ROP resource-query branch reuses the existing authenticated search/detail services with bounded pages and signed continuation state; full exports remain on the existing authenticated streamed-download path instead of entering model context.
- The safe analytics projection and catalog gain normalized ROP3 identity plus reviewed ROP hierarchy/classification fields. A server-owned relationship registry resolves the immutable ROP version bound to the dataset production lineage, compiles a null-preserving many-to-one relationship, and fails closed when that binding cannot be proven.
- Supabase may gain private version/entry storage for the semantic-context snapshot or extend the existing reference-resource lifecycle. PostgreSQL full-text search is the baseline retrieval candidate; pgvector exact search and reciprocal-rank fusion are enabled only if the approved bakeoff selects hybrid retrieval. RLS, least-privilege grants, immutable activation, and read-only execution remain mandatory.
- The chat request and gateway payload contracts change in a backwards-incompatible, versioned manner for the private pilot; no public API is introduced.
- UI smoke coverage expands for the dataset-to-chat handoff, filter chips, stale context, clear-context behavior, and capped-list wording.
- Vercel and Samson require coordinated prompt/schema/retriever hash rotation and a fresh pinned Qwen evaluation receipt. If selected by the bakeoff, Samson gains a separate local Qwen3-Embedding-0.6B service and possibly a Qwen3-Reranker-0.6B service that cannot consume database credentials or the generative Qwen slot. No new hosted vector database or third-party retrieval service is planned.
