## Context

Private data chat already uses a strong safety architecture: Qwen receives a server-owned semantic catalog and emits a typed plan; application code validates it, resolves controlled values, compiles parameterized SQL, and executes through a bounded read-only analytics role. The planner currently receives all nine approved fields and four approved metrics with descriptions, aliases, types, units, operators, and null meanings. The answer stage receives only the last user question, bounded rows, provenance, and definitions for selected concepts. The active country resource is used after planning for deterministic alias resolution; other reference resources and mutable field definitions are not supplied to Qwen.

The production Sudan investigation exposed three distinct values:

- `103` records have explicit `frontier_group=true`.
- `104` records match the current UUPG table filter.
- `100` records were returned by a capped record query and were incorrectly described as the total.

The UUPG filter is authoritative. With both criteria enabled it matches `(global engagement is false or blank) AND (frontier group is true or blank)`. In current Sudan data, 67 records satisfy both explicit values and 37 more match because at least one value is blank. The table implements this predicate in client filtering while chat has no named UUPG concept and its query AST cannot express the two OR branches. The answer payload also lacks query mode, requested limit, matched count, and `hasMore`, so `rowCount=100` looked like a total to the narrator.

Accelerate Global maintains richer semantic material that could improve interpretation and explanation: 241 field definitions (82 currently populated), canonical aliases, source links, source priorities, source contracts, named pipeline/filter contracts, filter regions, and seven active reference resources covering country codes, ROP taxonomy, source aliases, people crosswalks, merge priorities, and engagement mappings. This material varies in quality and sensitivity. For example, the current field-definition wording for global engagement conflicts with the forming conversion and approved chat meaning. Runtime mutable metadata therefore cannot be injected directly into prompts.

The design must remain lightweight on Vercel and Samson, avoid a new managed vector service, preserve the single Qwen inference slot, and keep model/database authority separated.

## Research Synthesis (current through August 31, 2026)

Primary-source research changes the earlier “lexical first, embeddings someday” assumption into a benchmark-selected, hybrid-capable design:

- Peer-reviewed 2026 multi-turn RAG work supports sparse+dense retrieval, controlled query rewriting, and reranking, but does not establish that every corpus benefits enough to justify all three components.
- EACL and ACL 2026 structured-data work treats schema linking and structurally compatible context selection as separate retrieval problems. Compact, relevant schema subsets outperform full-schema context in the cited evaluations; LLM-free structural expansion can improve multi-table retrieval at lower latency.
- ICLR 2025 shows that adding retrieved passages can eventually reduce answer quality because hard negatives distract the generator. Context must therefore be assembled for coverage and precision under a fixed budget, not by top-k similarity alone.
- ACL 2025 enterprise text-to-SQL systems combine terminology grounding, focused schema alignment, and retrieved examples. For this system, the safe analogue is reviewed question-to-semantic-plan examples—not question-to-SQL examples and never runtime-generated SQL.
- PostgreSQL/Supabase already provide mature full-text search, pgvector exact search, permission-aware retrieval, and reciprocal-rank fusion. At the expected semantic-card scale, exact vector search preserves perfect recall and avoids an approximate-nearest-neighbor index.
- Qwen publishes Apache-2.0 Qwen3-Embedding-0.6B and Qwen3-Reranker-0.6B models with local Transformers, Sentence Transformers, TEI, and vLLM paths. They are credible local candidates, not assumed winners on Accelerate Global language.
- NeurIPS/ACL evaluation work supports measuring retrieval and generation separately and calibrating automated judges against human labels. The existing deterministic SQL/plan corpus remains the primary gate.
- OWASP and current Microsoft guidance treat every retrieved chunk as untrusted, require permission-aware retrieval and integrity/version controls, and recommend bounded context plus output validation. Dense retrieval adds an embedding-poisoning and sensitive-derived-data surface that must be governed like source content.

The detailed evidence and adoption/rejection record is in `research.md`.

## Goals / Non-Goals

**Goals:**

- Give Qwen the smallest relevant set of reviewed Accelerate Global definitions needed for the current question.
- Make the exact active dataset view—dataset version, filters, filter options, and sort—available as trusted conversational context.
- Use one versioned named-filter definition for both table filtering and deterministic SQL compilation, beginning with UUPG.
- Distinguish matching totals, returned rows, page limits, and truncation in every result and response.
- Make user-visible numeric facts derive from typed database evidence rather than unconstrained model strings.
- Support factual definition questions without widening the set of queryable columns, joins, or actions.
- Keep retrieval deterministic, bounded, testable, permission-aware, and checksum/version bound.
- Select the lightest retrieval tier that meets an approved, held-out Accelerate Global benchmark while preserving an exact-match fast path.
- Reuse existing metadata and evaluation fixtures without duplicating authority or leaking evaluation holdouts into retrieved demonstrations.
- Preserve existing authentication, canary restriction, read-only database role, parameterized compiler, resource limits, and redacted audit policy.

**Non-Goals:**

- Sending the full database schema, raw field registry, full crosswalk payloads, SQL, credentials, or unrestricted database values to Qwen.
- Letting retrieval make a field queryable or authorize a join automatically.
- Adding an autonomous agent/tool loop or allowing Qwen to call resources directly.
- Assuming embeddings, reranking, or approximate vector indexes are required before the domain benchmark proves their value.
- Answering general-knowledge questions outside reviewed Accelerate Global datasets and semantic resources.
- Persisting raw conversations, raw result rows, or active filter values in analytics audit evidence.
- Replacing the existing country resolver or deterministic semantic compiler.
- Using GraphRAG/RAPTOR for the current atomic structured corpus, autonomous retrieval/tool loops, model-generated SQL probes, runtime-generated demonstrations, or web-search correction.

## Decisions

### 1. Use structured semantic RAG with a benchmark-selected retrieval tier

Exact concept keys and normalized aliases are the non-negotiable first path and cannot be displaced by a semantic score. The production retrieval tier will then be selected by a frozen, held-out Accelerate Global bakeoff:

1. **Lexical baseline:** exact/alias resolution plus PostgreSQL full-text ranking over contextual semantic cards.
2. **Hybrid candidate:** the lexical baseline plus Qwen3-Embedding-0.6B query/card embeddings, exact pgvector similarity search, and reciprocal-rank fusion.
3. **Reranked candidate:** the hybrid candidate plus Qwen3-Reranker-0.6B over only the bounded fused candidate set.

The smallest tier that meets every critical gate wins. Dense retrieval must demonstrate a material held-out recall/ranking improvement over lexical retrieval and meet the latency/capacity envelope; the reranker must then demonstrate an additional material gain. A component is not adopted merely because it improves a general benchmark. The lexical baseline must independently pass every exact alias, named-filter, resolver, security-critical, and safe-fallback case.

If hybrid retrieval wins, card embeddings are generated only from an approved immutable snapshot by a separate local Samson embedding service. Query embeddings use a fixed English retrieval instruction specialized to “retrieve reviewed Accelerate Global semantic evidence,” because the official Qwen model is instruction-aware. The embedding and optional reranking services have no database credentials, no model tools, no public route, and no ability to consume the single generative Qwen 3.6 slot. Model artifact, instruction, dimension, runtime, and card checksum are release-bound.

The expected card corpus is small enough for exact pgvector search, which preserves perfect recall. HNSW/IVFFlat are rejected until catalog growth makes exact search miss an explicit latency objective; any future approximate index requires a separate recall benchmark and review.

The nine-field/four-metric core query catalog remains always available to the planner. Retrieval augments it with relevant definitions, named filters, typed dependencies, lineage/resource summaries, and at most two approved semantic-plan examples. Dumping all metadata into every prompt remains rejected because it increases ambiguity, hard-negative distraction, injection surface, and stale/conflicting context.

### 2. Build a reviewed, immutable semantic-context snapshot

The existing private reference-resource candidate/review/activation lifecycle will be reused for a new `semantic-context-catalog` resource rather than introducing a separate content platform. A builder will derive a candidate from:

- the approved private-data-chat catalog;
- field definitions and canonical aliases;
- source field contracts and their versions;
- field-source mappings and source-priority keys;
- the shared named-filter registry;
- relevant pipeline semantic contracts;
- filter-region definitions;
- summaries and resolver capabilities of active reference resources; and
- a separately reviewed demonstration pool derived from sanitized semantic-plan fixtures, with evaluation holdouts excluded.

The candidate contains normalized entries and source lineage, not the full country, ROP, PEID, PeopleID3, or other crosswalk payloads. It receives a canonical checksum, schema version, source-version manifest, validation findings, and conflict findings. Activation requires human review. A missing definition may be included as lineage-only, but a contradictory definition cannot become planner- or answer-eligible until resolved or explicitly overridden in the reviewed semantic overlay.

Blake is the semantic conflict approver during the pilot. Runtime semantic resources and human guiding documents are not independent masters: they are two synchronized projections of one versioned semantic definition package. A structured-resource edit regenerates the affected guiding-document sections in the same candidate. A supported guiding-document edit is parsed into a candidate diff against the structured package. Review shows both representations together, activation advances them atomically, and CI/activation fails when their canonical semantic checksums diverge.

“Vice versa” therefore does not mean automatic last-write-wins synchronization. Ambiguous prose, unsupported structure, conflicting concurrent changes, or a document edit that would widen query authority is quarantined for Blake’s decision. This preserves human-editable guidance without allowing documentation text to silently mutate runtime behavior.

Each semantic card has a stable shape and deterministic contextual search text:

```text
concept key, kind, dataset and grain, label, approved definition, aliases,
value type, unit, null meaning, allowed-value or resolver policy,
metric formula or named-filter AST summary, typed dependency/relationship edges,
safe-join capability key if separately approved, examples and counterexamples,
source references, versions, freshness, sensitivity, allowed audiences,
query authority, retrieval tags, contextual search text, and content checksum
```

The contextual search text is produced deterministically from the structured card—for example, dataset, grain, concept kind, label, definition, filter/resource scope, aliases, and active version are prepended to the searchable body. It is never authored by an ingestion-time LLM. This adopts contextual retrieval’s useful disambiguation pattern without creating a second generative ingestion pipeline.

Planning demonstrations are a separate card kind containing a reviewed user-question pattern, relevant concept/filter keys, and the exact typed semantic plan. They never contain SQL, result rows, production questions, credentials, or compiler mappings. Demonstration and evaluation sets are grouped and deduplicated by intent/plan skeleton before splitting so a paraphrase of a holdout cannot leak into the prompt.

The `queryAuthority` classification is one of:

- `queryable`: already present in the checksum-bound query catalog;
- `explanatory-only`: safe to explain but unavailable in typed plans;
- `resolver-only`: values remain behind deterministic application resolution; or
- `excluded`: retained only as a validation finding and never sent to Qwen.

Activation never changes queryability. A separate reviewed query-catalog release is still required to add a field, metric, named filter, relationship, or operation.

### 3. Assemble minimal context with controlled query views and typed coverage

Retrieval is a staged, deterministic context-assembly process rather than a flat top-k dump:

1. Normalize the latest user utterance and perform exact concept/alias and approved value-domain resolution.
2. Create bounded retrieval views from the original utterance, verified current-view concept/filter keys, and verified prior-turn concept/evidence keys. Ambiguous phrases such as “those” may be expanded only from signed state; no model call rewrites the query.
3. Retrieve eligible cards through the selected lexical or hybrid tier.
4. Expand only reviewed typed dependencies needed for semantic completeness. For example, `uupg` pulls its active criteria and the `global_engagement_anywhere`/`frontier_group` cards; a metric pulls its dataset grain, unit, and formula dependencies.
5. Select a set that maximizes required concept coverage and excludes redundant or hard-negative cards. Exact/current-view cards are pinned, stable authority/scope priority breaks conflicts, and lower-priority similarity hits cannot displace required evidence.
6. Optionally add at most two reviewed semantic-plan demonstrations whose intent and plan skeleton are relevant and whose catalog versions match.

The complete retrieved payload is limited to six items and 8 KiB; demonstrations count toward both limits. The assembly policy reserves capacity for exact/current-view concepts, required dependencies, and then supporting explanation/examples in that order. If required evidence cannot fit, conflicts, or falls below the approved confidence/coverage policy, the server asks a bounded clarification or fails closed instead of filling the prompt with more candidates.

Planner retrieval and answer retrieval remain separate. Planner context favors meanings, capabilities, filters, resolver outputs, and plan examples. Answer context is restricted to compiled concepts, applied filters, result completeness, and explicitly requested explanations.

### 4. Treat retrieved text as untrusted data

The application—not a retrieved entry—defines system instructions. Retrieved entries are serialized into a strict data-only schema and enclosed as semantic evidence. Instruction-like strings, unsupported markup, oversized fields, control characters, invalid aliases, and sensitivity-policy violations fail snapshot validation. Qwen is reminded that retrieved content supplies definitions, never instructions or authority.

Retrieved entries are filtered by authenticated role, dataset scope, planner/answer audience, and approved sensitivity before scoring. Raw provider objects and user-authored field text are not passed through. This preserves the current prompt-injection boundary.

Permission and scope filters are applied before lexical/vector ranking through private database policy, not after a broad result set is returned. Every stored search card and embedding inherits source identity, audience, sensitivity, snapshot checksum, and deletion/expiry state. Only the reviewed activation pipeline may write cards or embeddings; runtime application and model services are read-only.

If dense retrieval is selected, embeddings are treated as sensitive derived data. The release binds the embedding model artifact/revision, instruction, output dimension, and per-card checksum; activation verifies a canonical index manifest, and rollback restores the prior immutable snapshot. Tests cover poisoning-shaped text, invisible Unicode, unusually broad similarity, lexical/dense disagreement, cross-audience leakage, stale embeddings, and model-version drift.

Internal signed lineage remains available for debugging and audit even though chat does not render a user-facing “Data provenance” section. Removing that presentation does not remove source integrity, reproducibility, or access-control evidence.

### 5. Create one shared named-filter registry

Named filters will be represented as a small typed expression AST owned by application code. The same AST will be:

- evaluated against in-memory table rows;
- compiled into trusted SQL expressions;
- rendered into user-facing filter descriptions;
- included in the semantic-context snapshot; and
- referenced by typed model plans and current-view context.

Qwen never emits arbitrary AND/OR expression trees. It may select only an approved named-filter key and validated options. The deterministic compiler expands the trusted AST.

`uupg` version 1 will encode the current UI filter exactly. Its options identify whether `globalEngagementAnywhere` and `frontierGroup` criteria are enabled. With both enabled, blank values match exactly as they do now. If only one criterion is enabled, only that branch applies. The filter description must state the active branches and blank behavior. The current table filter is the source of truth; the pipeline product with a similar name does not silently replace it.

The visible rationale is that this interactive view is deliberately null-preserving: blank global-engagement data means there is no recorded positive engagement, and a blank frontier value means there is no recorded negative frontier classification. The view keeps those potentially qualifying rows so incomplete source data does not create a false exclusion; explicit `global engagement=true` or `frontier=false` still excludes the row when that criterion is enabled. This rationale is supported by the original filter wording (“no global engagement record” and frontier `TRUE` “when present”) and the repository’s null-preserving regression tests.

This rationale applies to the interactive current-view UUPG filter chosen by the user. It does not redefine the separately versioned Baseline UUPG pipeline, which currently requires explicit `global engagement=false` and applies its source-qualified frontier rule.

Parity tests will execute the same fixture through the TypeScript row evaluator and SQL compiler and require identical record identities and counts. No release may carry two independent UUPG implementations.

### 6. Hand current dataset views to chat with signed ephemeral context

The approved primary dataset page will expose **Ask Qwen about this view**. The client sends its current serializable filter/sort state to a same-origin guarded endpoint. The server validates:

- authenticated pilot identity and session;
- approved primary dataset identity and exact version;
- named-filter registry version;
- allowed fields, operators, values, result scope, and sort; and
- payload and expiry bounds.

The endpoint returns a short-lived signed context token plus a safe display summary. A dedicated secret signs the token; it is not reused from gateway or audit HMAC keys. The token is bound to the user/session, dataset/version, registry checksum, issued time, and a 30-minute maximum expiry. It is stored in same-origin session storage, not placed in the URL, and is cleared on new chat, explicit clear, sign-out, expiry, or validation failure. No database table is required for the first release.

Every chat request may include the token. The server verifies it and converts it into trusted typed context before planning. Client-provided counts are never authoritative. Chat displays filter chips and quick prompts from the server-generated summary, for example `All People Groups`, `Sudan`, and `UUPG`. The user can clear the context or return to the table. If the dataset version or filter-registry checksum changes, the server rejects the stale context and asks the user to refresh it.

### 7. Keep trusted prior-turn evidence separate from conversational prose

The current client resends assistant prose, but it cannot prove which query or result produced that prose. Each successful server turn will additionally return a compact signed turn-state token containing no raw prompt or rows, only:

- semantic decision class and catalog/filter/snapshot versions;
- selected concept and named-filter keys;
- normalized query mode and bounds;
- matching/returned counts and `hasMore`;
- dataset/version identity; and
- stable evidence identifiers and result checksum.

The next request may include recent signed turn-state tokens. The planner and narrator use verified structured summaries to resolve follow-ups such as “show those,” “why did that differ,” or “is that the total.” Unverified client assistant text remains conversation content, not evidence.

### 8. Make result completeness a first-class contract

The typed execution result will include:

```text
mode, requestedLimit, returnedCount, matchedCount, hasMore,
selected concepts, applied named filters, dataset version, and bounded rows
```

Record queries will obtain a matching total through a bounded internal count/window strategy and return only the approved row limit. Internal count fields are stripped before rows are sent to Qwen or the browser. Aggregate queries continue to return exact metric rows and are marked complete for their requested aggregation.

The broker will reject inconsistent combinations such as `returnedCount > requestedLimit`, `matchedCount < returnedCount`, or `hasMore=false` when the values disagree. Audit evidence records the query mode, requested limit, returned count, matching count, named-filter keys, and context/snapshot hashes without raw values or rows.

### 9. Render authoritative numeric facts from an evidence ledger

Application code will turn typed results into a stable evidence ledger with identifiers such as `metric.people_group_count`, `result.matched_count`, and `result.returned_count`. Qwen may compose prose using evidence references but may not originate numeric fact strings. The server renders numeric values and units from the referenced evidence after validating scope.

For common scalar aggregates and completeness statements, the first sentence and fact bullets are deterministic. A record result at the cap must render, for example, `103 people groups match; showing 100`, never `there are 100`. If Qwen returns an unknown evidence reference, changes a value/unit/scope, or makes an unsupported total claim, the narrative is discarded and the deterministic answer is used.

This is preferred over merely adding prompt instructions: the incident passed JSON-schema validation because the wrong `100` was structurally valid and present as a returned-row count.

### 10. Use large reference resources through deterministic resolvers

The semantic snapshot contains only resource summaries, schemas, versions, value-domain policy, and supported resolution operations. Exact country, ROP, PEID, PeopleID3, source-alias, and engagement-mapping values stay behind existing or new server-side resolvers. Deterministic resolution runs before context assembly when an approved domain is relevant, supplies only the canonical matched identifier/display value and ambiguity status, and records active-version lineage. Neither Qwen nor the retriever receives the full domain.

The initial release keeps country resolution as the only value resolver used in SQL. Current-view filter values are accepted only from the signed, validated view contract. Phase one also permits reviewed ROP definition and exact-code lookup through a typed deterministic resolver. The resolver returns only the requested canonical match/ambiguity state; it does not hand Qwen the full ROP catalog. ROP and crosswalk resources do not become data filters or joins until separately modeled in the query catalog and analytics projection.

“No unrestricted browsing, filtering, or joins” means:

- **No bulk browsing:** Qwen cannot enumerate or page through the complete ROP catalog merely because exact lookup exists.
- **No implicit data filtering:** a metadata lookup such as “what is ROP3 code X?” does not authorize “filter all people-group data by arbitrary ROP code X.”
- **No model-chosen joins:** Qwen cannot choose database keys and connect the ROP catalog to people-group rows. Any future filter/join is a named, reviewed server-owned capability with a trusted projection, deterministic compiler mapping, and tests.

### 11. Separate planner retrieval from answer retrieval

Planner retrieval uses the latest user turns, signed view context, and signed prior-turn evidence to find concepts needed to form a typed plan. It receives concise definitions, aliases, named-filter descriptions, capability constraints, deterministic resolver outputs, and zero to two reviewed semantic-plan examples. Retrieved examples illustrate only the typed plan contract; they never carry SQL or compiler authority.

Answer retrieval is restricted to concepts selected by the compiled query plus any explanatory concept explicitly requested by the user. It receives result completeness and evidence-ledger metadata. This prevents unrelated retrieved definitions from influencing narration.

Definition-only questions may use `decision=answer` when the answer is fully supported by retrieved explanatory entries. The response remains scoped to Accelerate Global material, cites evidence internally, and refuses unsupported general-knowledge requests.

Prompt ordering is part of the versioned retrieval policy. Retrieved material is visibly serialized as data, highest-authority exact/current-view evidence is placed before lower-priority support, and system constraints are reinforced after the retrieved block. Ordering alternatives are evaluated with deliberate hard negatives against the pinned Qwen artifact rather than assumed from another model.

### 12. Cache by active checksum and stay within a fixed context budget

Vercel caches the immutable active snapshot pointer and card manifest by version/checksum; a short TTL controls pointer refresh, never card mutability. Exact aliases use a checksum-bound in-process map. PostgreSQL full-text search is the baseline ranked path. If the bakeoff selects dense retrieval, Supabase stores snapshot-bound card embeddings in a private pgvector column and uses exact vector search plus reciprocal-rank fusion; the query embedding is obtained from the isolated Samson sidecar. No approximate index is created at the expected card scale.

The lexical path targets p95 below 25 ms. A selected hybrid path must add no more than 250 ms p95 retrieval latency, must not cause swap, must leave at least 10% of allocated Samson RAM/VRAM free under sustained canary load, must introduce no new generative queue failures, and must not worsen generative Qwen p95 by more than 5%. A selected reranker has a separate 500 ms p95 ceiling and must demonstrate additional held-out value. The total model context remains limited to six retrieved items and 8 KiB.

If the active snapshot is unavailable or unhealthy, data queries may continue with the current core catalog only when no retrieved or named-filter knowledge is required. If a selected dense/rerank service is unavailable, the independently qualified exact/full-text path may serve only when its confidence/coverage policy is satisfied; otherwise the request fails closed with a retryable semantic-context error. A definition question or context requiring the unavailable snapshot never falls back to model world knowledge.

### 13. Preserve existing authorization and provider boundaries

The server verifies current identity before creating or consuming view/turn tokens. Runtime authorization continues to use `raw_app_meta_data.workspace_role`, current canary configuration, RLS, and the read-only analytics function/view. Neither signed context nor retrieved metadata can grant dataset access. The model receives no Supabase, Cloudflare, Samson, or Vercel credentials.

The semantic resource and any private projections remain in non-exposed schemas with explicit grants. If a migration extends the existing reference-resource kind or projections, local database security tests must verify that `anon`, `authenticated`, `service_role`, and analytics roles cannot mutate or bypass activation policy.

### 14. Make the incident a release-blocking evaluation family

The deterministic and live-Qwen suites will add:

- the exact multi-turn count/list/challenge sequence that produced 100;
- 103 matches with a 100-row cap, requiring `showing 100 of 103`;
- UUPG table/SQL parity fixtures for explicit and blank values;
- current-view context with country Sudan and UUPG enabled;
- stale, tampered, expired, cross-user, and non-primary context tokens;
- retrieved-definition conflicts, prompt-like metadata, and sensitivity filtering;
- exact/alias/full-text/hybrid/rerank retrieval ranking, typed dependency coverage, deterministic multi-turn rewriting, plan-example selection, hard negatives, and context-budget boundaries;
- definition-only questions, unsupported concepts, and off-topic refusals;
- ROP/country resolver-only resources that cannot become arbitrary filters;
- signed prior-turn evidence versus forged assistant prose; and
- deterministic fallback when Qwen cites the wrong evidence scope.

Retrieval receives its own human-reviewed relevance corpus and grouped train/dev/holdout split. The release gate requires 100% Recall@1 for exact keys/aliases, named filters, and resolver-critical cases; 100% required-evidence set coverage for release-blocking multi-concept cases; at least 95% Recall@6 on held-out paraphrases; zero cross-audience or excluded-card retrieval; and no critical hard negative in the final context. nDCG@6, MRR, clarification/abstention accuracy, irrelevant-context rate, serialized bytes, and latency are reported for diagnosis. A denser tier must improve held-out Recall@6 or nDCG@6 by at least three absolute points or fix at least three predeclared material failures without a critical regression; reranking must meet the same rule over the hybrid candidate.

Planning, SQL, and narration remain separate gates: semantic-plan exactness/validity, compiler/result execution accuracy, evidence-claim precision, answer faithfulness, clarification quality, and off-topic refusal are measured independently. RAGChecker/RAGAS/ARES-style automated diagnostics may supplement review, but release cannot depend solely on an LLM judge; a human-calibrated set and deterministic assertions remain authoritative.

The exact generative model, embedding/rerank artifacts if used, runtimes, retrieval instructions, planner prompt, answer prompt, response schemas, query catalog, named-filter registry, semantic snapshot/index manifest, demonstration pool, retriever policy, compiler, and fixtures are hash-bound in the release receipt. Three clean repetitions and a production canary remain required after the new corpus is approved.

## Risks / Trade-offs

- **[Conflicting metadata could make answers worse]** → Candidate validation separates queryable, explanatory-only, resolver-only, and excluded entries; contradictions require review before activation.
- **[RAG could silently widen query access]** → Only the independent query catalog and named-filter registry affect typed plans and SQL; retrieved entries carry no compiler mapping.
- **[UI and SQL predicates could drift]** → Generate/evaluate both from one named-filter AST and require identity-level parity tests.
- **[Blank-inclusive UUPG behavior may surprise users]** → Treat current behavior as authoritative and render its exact active criteria/blank semantics in the context summary and retrieved definition.
- **[Signed tokens could be replayed or copied]** → Bind to identity/session, checksum, dataset version, and short expiry; reject cross-user and stale tokens.
- **[Prompt size could increase already-high latency]** → Typed coverage selection, six-item/8 KiB limits, hard-negative tests, stable ordering, and checksum caching.
- **[Local embedding/reranking could consume Samson capacity]** → Make both benchmark-optional; enforce latency, memory-headroom, no-swap, queue-impact, and failure-fallback gates before selection.
- **[Dense similarity could retrieve a plausible but wrong definition]** → Exact/current-view evidence is pinned, authority/dependency coverage precedes similarity, lexical+dense disagreement is logged, and critical hard negatives block release.
- **[Retrieved examples could leak evaluation answers or anchor the wrong plan]** → Maintain a small reviewed semantic-plan-only pool, split/deduplicate by intent and plan skeleton, cap at two, require catalog compatibility, and keep a sealed holdout.
- **[Embeddings or source cards could be poisoned or leak restricted metadata]** → Reviewed immutable ingestion, per-card/source/model checksums, pre-retrieval RLS/scope filtering, index integrity checks, no runtime writes, and adversarial retrieval tests.
- **[Model prose can still hallucinate]** → Render numeric facts from evidence references and fall back deterministically on any validation failure.
- **[Matching counts add database work]** → Use an approved bounded count/window plan, enforce existing cost/time limits, and benchmark against the 12,507-row primary dataset.
- **[Exact/full-text retrieval may miss unusual wording]** → Run the frozen bakeoff; select hybrid only when it clears material-gain and resource gates, without changing query authority.
- **[Benchmark tuning could overfit the retrieval policy]** → Freeze grouped train/dev/holdout partitions before tuning and require untouched holdout plus live-Qwen canary evidence.
- **[Resource versions can change independently]** → Snapshot checksum binds every cited source version; stale pointer/context checks fail closed.

## Migration Plan

1. Freeze the human-reviewed retrieval relevance corpus, grouped train/dev/holdout split, material-gain thresholds, and resource envelope; reconcile UUPG/global-engagement definitions before tuning retrieval.
2. Add the incident regression cases and result-completeness contract, then introduce the shared named-filter AST and prove table/SQL UUPG parity on fixtures and local Supabase.
3. Add result shape, matching totals, evidence ledger, deterministic fact rendering, and signed turn-state tokens behind a disabled server flag.
4. Extend the reference-resource lifecycle with contextual semantic cards, typed dependency edges, the reviewed semantic-plan demonstration pool, validation findings, activation, rollback, and the first immutable snapshot.
5. Implement exact aliases, PostgreSQL full-text search, deterministic multi-turn query views, dependency-aware coverage assembly, resolver integration, and definition-only answers behind `PRIVATE_DATA_CHAT_SEMANTIC_CONTEXT_ENABLED=false`.
6. Benchmark the full-text baseline against Qwen3-Embedding-0.6B plus exact pgvector/RRF and optional Qwen3-Reranker-0.6B on Samson. Select and document the smallest passing tier; deploy no dense component if it does not clear the predeclared gates.
7. Add signed current-view handoff and chat quick-reference UI behind the same pilot flag.
8. Update planner/answer prompts and schemas, rotate accepted gateway hashes with a bounded rolling overlap, and run the approved static retrieval, planner, answer, security, and end-to-end tiers.
9. Enable only for the existing production canary, run the exact Sudan/UUPG/count/list flow and hard-negative cases, inspect retrieval/completeness audit evidence, and monitor retrieval latency, Samson headroom, generation queue impact, and error rates.
10. Remove previous prompt/schema/retriever hashes after the strict canary passes; expand access only through a separate decision.

Rollback disables semantic context and current-view handoff, restores the previous prompt/schema/retriever hashes, stops the optional embedding/reranking sidecars if selected, and leaves immutable snapshots plus redacted audit evidence intact. The existing core catalog, typed planner, compiler, and database projection continue to serve the current pilot.

## Resolved Review Decisions (August 31, 2026)

- View-context lifetime is 30 minutes.
- Blake approves semantic conflicts during the pilot. Runtime resources and guiding documents change together through one candidate/review/activation workflow, regardless of which representation initiated the edit.
- Phase one supports deterministic ROP definitions and exact-code lookups, but not bulk catalog browsing, arbitrary ROP data filtering, or model-chosen joins.
- The visible UUPG quick reference states the blank-inclusive rule and its null-preserving reason, while distinguishing this interactive filter from the stricter Baseline UUPG pipeline.
- The proposed retrieval quality, latency, Samson headroom, and generative-impact gates are approved.
