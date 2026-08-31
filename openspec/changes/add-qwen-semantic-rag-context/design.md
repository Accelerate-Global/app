## Context

Private data chat already uses a strong safety architecture: Qwen receives a server-owned semantic catalog and emits a typed plan; application code validates it, resolves controlled values, compiles parameterized SQL, and executes through a bounded read-only analytics role. The planner currently receives all nine approved fields and four approved metrics with descriptions, aliases, types, units, operators, and null meanings. The answer stage receives only the last user question, bounded rows, provenance, and definitions for selected concepts. The active country resource is used after planning for deterministic alias resolution; other reference resources and mutable field definitions are not supplied to Qwen.

The production Sudan investigation exposed three distinct values:

- `103` records have explicit `frontier_group=true`.
- `104` records match the current UUPG table filter.
- `100` records were returned by a capped record query and were incorrectly described as the total.

The UUPG filter is authoritative. With both criteria enabled it matches `(global engagement is false or blank) AND (frontier group is true or blank)`. In current Sudan data, 67 records satisfy both explicit values and 37 more match because at least one value is blank. The table implements this predicate in client filtering while chat has no named UUPG concept and its query AST cannot express the two OR branches. The answer payload also lacks query mode, requested limit, matched count, and `hasMore`, so `rowCount=100` looked like a total to the narrator.

Accelerate Global maintains richer semantic material that could improve interpretation and explanation: 241 field definitions (82 currently populated), canonical aliases, source links, source priorities, source contracts, named pipeline/filter contracts, filter regions, and seven active reference resources covering country codes, ROP taxonomy, source aliases, people crosswalks, merge priorities, and engagement mappings. This material varies in quality and sensitivity. For example, the current field-definition wording for global engagement conflicts with the forming conversion and approved chat meaning. Runtime mutable metadata therefore cannot be injected directly into prompts.

The design must remain lightweight on Vercel and Samson, avoid a new managed vector service, preserve the single Qwen inference slot, and keep model/database authority separated.

## Goals / Non-Goals

**Goals:**

- Give Qwen the smallest relevant set of reviewed Accelerate Global definitions needed for the current question.
- Make the exact active dataset view—dataset version, filters, filter options, and sort—available as trusted conversational context.
- Use one versioned named-filter definition for both table filtering and deterministic SQL compilation, beginning with UUPG.
- Distinguish matching totals, returned rows, page limits, and truncation in every result and response.
- Make user-visible numeric facts derive from typed database evidence rather than unconstrained model strings.
- Support factual definition questions without widening the set of queryable columns, joins, or actions.
- Keep retrieval deterministic, bounded, testable, permission-aware, and checksum/version bound.
- Preserve existing authentication, canary restriction, read-only database role, parameterized compiler, resource limits, and redacted audit policy.

**Non-Goals:**

- Sending the full database schema, raw field registry, full crosswalk payloads, SQL, credentials, or unrestricted database values to Qwen.
- Letting retrieval make a field queryable or authorize a join automatically.
- Adding an autonomous agent/tool loop or allowing Qwen to call resources directly.
- Using embeddings or a hosted vector database in the first release.
- Answering general-knowledge questions outside reviewed Accelerate Global datasets and semantic resources.
- Persisting raw conversations, raw result rows, or active filter values in analytics audit evidence.
- Replacing the existing country resolver or deterministic semantic compiler.

## Decisions

### 1. Use structured semantic RAG, not vector-first document RAG

The initial retriever will combine exact concept/alias matching with a deterministic weighted lexical score over a small active semantic snapshot. Exact matches win, followed by normalized token overlap across labels, aliases, definitions, dataset scope, and tags. Retrieval will return at most six entries and at most 8 KiB of serialized context per model call. Stable concept-key ordering breaks score ties.

The nine-field/four-metric core query catalog remains always available to the planner. Retrieval augments it with relevant definitions, named filters, lineage summaries, and resource descriptions. Embeddings may be evaluated later only if a reviewed benchmark shows that deterministic retrieval misses materially important natural-language questions.

This avoids a new service, keeps retrieval explainable, runs within the Vercel process, and permits deterministic unit tests. Dumping all metadata into every prompt was rejected because it increases latency, ambiguity, prompt-injection surface, and stale/conflicting context.

### 2. Build a reviewed, immutable semantic-context snapshot

The existing private reference-resource candidate/review/activation lifecycle will be reused for a new `semantic-context-catalog` resource rather than introducing a separate content platform. A builder will derive a candidate from:

- the approved private-data-chat catalog;
- field definitions and canonical aliases;
- source field contracts and their versions;
- field-source mappings and source-priority keys;
- the shared named-filter registry;
- relevant pipeline semantic contracts;
- filter-region definitions; and
- summaries and resolver capabilities of active reference resources.

The candidate contains normalized entries and source lineage, not the full country, ROP, PEID, PeopleID3, or other crosswalk payloads. It receives a canonical checksum, schema version, source-version manifest, validation findings, and conflict findings. Activation requires human review. A missing definition may be included as lineage-only, but a contradictory definition cannot become planner- or answer-eligible until resolved or explicitly overridden in the reviewed semantic overlay.

Each entry has a stable shape:

```text
concept key, kind, dataset scope, label, approved definition, aliases,
value type, unit, null meaning, named-filter formula summary,
source references and versions, sensitivity, allowed audiences,
query authority classification, retrieval tags, and content checksum
```

The `queryAuthority` classification is one of:

- `queryable`: already present in the checksum-bound query catalog;
- `explanatory-only`: safe to explain but unavailable in typed plans;
- `resolver-only`: values remain behind deterministic application resolution; or
- `excluded`: retained only as a validation finding and never sent to Qwen.

Activation never changes queryability. A separate reviewed query-catalog release is still required to add a field, metric, named filter, relationship, or operation.

### 3. Treat retrieved text as untrusted data

The application—not a retrieved entry—defines system instructions. Retrieved entries are serialized into a strict data-only schema and enclosed as semantic evidence. Instruction-like strings, unsupported markup, oversized fields, control characters, invalid aliases, and sensitivity-policy violations fail snapshot validation. Qwen is reminded that retrieved content supplies definitions, never instructions or authority.

Retrieved entries are filtered by authenticated role, dataset scope, planner/answer audience, and approved sensitivity before scoring. Raw provider objects and user-authored field text are not passed through. This preserves the current prompt-injection boundary.

### 4. Create one shared named-filter registry

Named filters will be represented as a small typed expression AST owned by application code. The same AST will be:

- evaluated against in-memory table rows;
- compiled into trusted SQL expressions;
- rendered into user-facing filter descriptions;
- included in the semantic-context snapshot; and
- referenced by typed model plans and current-view context.

Qwen never emits arbitrary AND/OR expression trees. It may select only an approved named-filter key and validated options. The deterministic compiler expands the trusted AST.

`uupg` version 1 will encode the current UI filter exactly. Its options identify whether `globalEngagementAnywhere` and `frontierGroup` criteria are enabled. With both enabled, blank values match exactly as they do now. If only one criterion is enabled, only that branch applies. The filter description must state the active branches and blank behavior. The current table filter is the source of truth; the pipeline product with a similar name does not silently replace it.

Parity tests will execute the same fixture through the TypeScript row evaluator and SQL compiler and require identical record identities and counts. No release may carry two independent UUPG implementations.

### 5. Hand current dataset views to chat with signed ephemeral context

The approved primary dataset page will expose **Ask Qwen about this view**. The client sends its current serializable filter/sort state to a same-origin guarded endpoint. The server validates:

- authenticated pilot identity and session;
- approved primary dataset identity and exact version;
- named-filter registry version;
- allowed fields, operators, values, result scope, and sort; and
- payload and expiry bounds.

The endpoint returns a short-lived signed context token plus a safe display summary. A dedicated secret signs the token; it is not reused from gateway or audit HMAC keys. The token is bound to the user/session, dataset/version, registry checksum, issued time, and a 30-minute maximum expiry. It is stored in same-origin session storage, not placed in the URL, and is cleared on new chat, explicit clear, sign-out, expiry, or validation failure. No database table is required for the first release.

Every chat request may include the token. The server verifies it and converts it into trusted typed context before planning. Client-provided counts are never authoritative. Chat displays filter chips and quick prompts from the server-generated summary, for example `All People Groups`, `Sudan`, and `UUPG`. The user can clear the context or return to the table. If the dataset version or filter-registry checksum changes, the server rejects the stale context and asks the user to refresh it.

### 6. Keep trusted prior-turn evidence separate from conversational prose

The current client resends assistant prose, but it cannot prove which query or result produced that prose. Each successful server turn will additionally return a compact signed turn-state token containing no raw prompt or rows, only:

- semantic decision class and catalog/filter/snapshot versions;
- selected concept and named-filter keys;
- normalized query mode and bounds;
- matching/returned counts and `hasMore`;
- dataset/version identity; and
- stable evidence identifiers and result checksum.

The next request may include recent signed turn-state tokens. The planner and narrator use verified structured summaries to resolve follow-ups such as “show those,” “why did that differ,” or “is that the total.” Unverified client assistant text remains conversation content, not evidence.

### 7. Make result completeness a first-class contract

The typed execution result will include:

```text
mode, requestedLimit, returnedCount, matchedCount, hasMore,
selected concepts, applied named filters, dataset version, and bounded rows
```

Record queries will obtain a matching total through a bounded internal count/window strategy and return only the approved row limit. Internal count fields are stripped before rows are sent to Qwen or the browser. Aggregate queries continue to return exact metric rows and are marked complete for their requested aggregation.

The broker will reject inconsistent combinations such as `returnedCount > requestedLimit`, `matchedCount < returnedCount`, or `hasMore=false` when the values disagree. Audit evidence records the query mode, requested limit, returned count, matching count, named-filter keys, and context/snapshot hashes without raw values or rows.

### 8. Render authoritative numeric facts from an evidence ledger

Application code will turn typed results into a stable evidence ledger with identifiers such as `metric.people_group_count`, `result.matched_count`, and `result.returned_count`. Qwen may compose prose using evidence references but may not originate numeric fact strings. The server renders numeric values and units from the referenced evidence after validating scope.

For common scalar aggregates and completeness statements, the first sentence and fact bullets are deterministic. A record result at the cap must render, for example, `103 people groups match; showing 100`, never `there are 100`. If Qwen returns an unknown evidence reference, changes a value/unit/scope, or makes an unsupported total claim, the narrative is discarded and the deterministic answer is used.

This is preferred over merely adding prompt instructions: the incident passed JSON-schema validation because the wrong `100` was structurally valid and present as a returned-row count.

### 9. Use large reference resources through deterministic resolvers

The semantic snapshot contains only resource summaries, schemas, aliases, versions, and supported resolution operations. Exact country, ROP, PEID, PeopleID3, source-alias, and engagement-mapping values stay behind existing or new server-side resolvers. The planner emits approved typed identifiers; deterministic code resolves them and records version lineage.

The initial release keeps country resolution as the only value resolver used in SQL. ROP and crosswalk resources may answer approved metadata-definition questions, but they do not become query filters or joins until separately modeled in the query catalog and analytics projection.

### 10. Separate planner retrieval from answer retrieval

Planner retrieval uses the latest user turns, signed view context, and signed prior-turn evidence to find concepts needed to form a typed plan. It receives concise definitions, aliases, named-filter descriptions, and capability constraints.

Answer retrieval is restricted to concepts selected by the compiled query plus any explanatory concept explicitly requested by the user. It receives result completeness and evidence-ledger metadata. This prevents unrelated retrieved definitions from influencing narration.

Definition-only questions may use `decision=answer` when the answer is fully supported by retrieved explanatory entries. The response remains scoped to Accelerate Global material, cites evidence internally, and refuses unsupported general-knowledge requests.

### 11. Cache by active checksum and stay within a fixed context budget

Vercel loads the active semantic snapshot server-side and builds the deterministic index in memory. The cache key is the active resource version/checksum; a short TTL only controls pointer refresh. Cached content is immutable. Retrieval has a target p95 below 25 ms, a six-entry limit, and an 8 KiB serialized context limit. No additional Samson inference call is added.

If the active snapshot is unavailable or unhealthy, data queries may continue with the current core catalog only when no retrieved or named-filter knowledge is required. A definition question or context requiring the unavailable snapshot fails closed with a retryable semantic-context error.

### 12. Preserve existing authorization and provider boundaries

The server verifies current identity before creating or consuming view/turn tokens. Runtime authorization continues to use `raw_app_meta_data.workspace_role`, current canary configuration, RLS, and the read-only analytics function/view. Neither signed context nor retrieved metadata can grant dataset access. The model receives no Supabase, Cloudflare, Samson, or Vercel credentials.

The semantic resource and any private projections remain in non-exposed schemas with explicit grants. If a migration extends the existing reference-resource kind or projections, local database security tests must verify that `anon`, `authenticated`, `service_role`, and analytics roles cannot mutate or bypass activation policy.

### 13. Make the incident a release-blocking evaluation family

The deterministic and live-Qwen suites will add:

- the exact multi-turn count/list/challenge sequence that produced 100;
- 103 matches with a 100-row cap, requiring `showing 100 of 103`;
- UUPG table/SQL parity fixtures for explicit and blank values;
- current-view context with country Sudan and UUPG enabled;
- stale, tampered, expired, cross-user, and non-primary context tokens;
- retrieved-definition conflicts, prompt-like metadata, and sensitivity filtering;
- exact/alias/lexical retrieval ranking and context-budget boundaries;
- definition-only questions, unsupported concepts, and off-topic refusals;
- ROP/country resolver-only resources that cannot become arbitrary filters;
- signed prior-turn evidence versus forged assistant prose; and
- deterministic fallback when Qwen cites the wrong evidence scope.

The exact model, runtime, planner prompt, answer prompt, response schemas, query catalog, named-filter registry, semantic snapshot, retriever policy, compiler, and fixtures are hash-bound in the release receipt. Three clean repetitions and a production canary remain required after the new corpus is approved.

## Risks / Trade-offs

- **[Conflicting metadata could make answers worse]** → Candidate validation separates queryable, explanatory-only, resolver-only, and excluded entries; contradictions require review before activation.
- **[RAG could silently widen query access]** → Only the independent query catalog and named-filter registry affect typed plans and SQL; retrieved entries carry no compiler mapping.
- **[UI and SQL predicates could drift]** → Generate/evaluate both from one named-filter AST and require identity-level parity tests.
- **[Blank-inclusive UUPG behavior may surprise users]** → Treat current behavior as authoritative and render its exact active criteria/blank semantics in the context summary and retrieved definition.
- **[Signed tokens could be replayed or copied]** → Bind to identity/session, checksum, dataset version, and short expiry; reject cross-user and stale tokens.
- **[Prompt size could increase already-high latency]** → Deterministic top-six retrieval, 8 KiB limit, checksum cache, and no additional inference call.
- **[Model prose can still hallucinate]** → Render numeric facts from evidence references and fall back deterministically on any validation failure.
- **[Matching counts add database work]** → Use an approved bounded count/window plan, enforce existing cost/time limits, and benchmark against the 12,507-row primary dataset.
- **[Exact lexical retrieval may miss unusual wording]** → Measure retrieval recall first; add embeddings only behind a separately reviewed benchmark and without changing query authority.
- **[Resource versions can change independently]** → Snapshot checksum binds every cited source version; stale pointer/context checks fail closed.

## Migration Plan

1. Add the incident regression cases and result-completeness contract before changing prompts.
2. Introduce the shared named-filter AST and prove table/SQL UUPG parity on fixtures and local Supabase.
3. Add result shape, matching totals, evidence ledger, deterministic fact rendering, and signed turn-state tokens behind a disabled server flag.
4. Extend the reference-resource lifecycle with a semantic-context candidate builder, validation findings, review, and activation; reconcile the global-engagement wording before activating the first snapshot.
5. Add deterministic retrieval and definition-only answers behind `PRIVATE_DATA_CHAT_SEMANTIC_CONTEXT_ENABLED=false`.
6. Add signed current-view handoff and chat quick-reference UI behind the same pilot flag.
7. Update planner/answer prompts and schemas, rotate accepted gateway hashes with a bounded rolling overlap, and run the approved static and live evaluation tiers.
8. Enable only for the existing production canary, run the exact Sudan/UUPG/count/list flow, inspect retrieval and completeness audit evidence, and monitor latency/error rates.
9. Remove previous prompt/schema hashes after the strict canary passes; expand access only through a separate decision.

Rollback disables semantic context and current-view handoff, restores the previous prompt/schema hashes, and leaves the immutable semantic snapshot and redacted audit evidence intact. The existing core catalog, typed planner, compiler, and database projection continue to serve the current pilot.

## Open Questions

- Confirm the 30-minute view-context lifetime or choose a shorter value.
- Decide which content owner approves conflicts in field-definition wording before semantic snapshot activation.
- Decide whether the first release should answer ROP definition/code questions or expose only the resource summary while preserving exact ROP lookup for a later phase.
- Confirm that current UUPG blank matching should be stated explicitly in the visible quick-reference description as well as used internally.
