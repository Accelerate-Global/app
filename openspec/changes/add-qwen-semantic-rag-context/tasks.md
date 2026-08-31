## 1. Planning, Definitions, and Incident Baseline

- [ ] 1.1 Run `pnpm run verify:change` and `pnpm run task:kickoff` with ownership covering private-data-chat, dataset filtering/view UI, reference resources, migrations, OpenSpec, and UI journeys; record the required commands, targeted smoke subset, and local Supabase requirement before implementation.
- [ ] 1.2 Add a sanitized incident fixture representing 180 Sudan rows, 103 frontier matches, 104 authoritative UUPG matches, 67 explicit dual-criterion matches, and a 100-row record limit; preserve no production identifiers or rows.
- [ ] 1.3 Record the authoritative interactive UUPG v1 definition from the current filter, including enabled criteria, blank matching, the null-preserving/no-false-exclusion rationale, and its distinction from the Baseline UUPG pipeline; use the user-approved wording in the visible quick reference.
- [ ] 1.4 Reconcile the conflicting global-engagement field-definition wording with forming conversion, source contracts, and the approved boolean direction before making that entry retrieval-eligible; route unresolved semantic conflicts to Blake during the pilot.
- [ ] 1.5 Generate the proposed planner, answer, retrieval, current-view, completeness, and adversarial evaluation corpus for human review without calling Qwen, Samson, Supabase production, Cloudflare, or Vercel.
- [ ] 1.6 Add human relevance labels for exact, paraphrase, multi-concept, multi-turn, hard-negative, ambiguity, off-topic, and security cases; group/deduplicate by intent and plan skeleton, freeze train/dev/holdout partitions, and keep the holdout sealed from retrieval-example selection.
- [ ] 1.7 Obtain review of the proposed retrieval promotion and resource gates before tuning: critical Recall@1/set coverage, held-out Recall@6, material-gain rule, context budget, lexical/hybrid/rerank latency, Samson headroom, and generation-queue impact.

## 2. Shared Named-Filter Registry

- [ ] 2.1 Define a versioned typed named-filter expression schema that supports trusted conjunction/disjunction, equality, and missing-value checks without exposing arbitrary expression construction to Qwen.
- [ ] 2.2 Encode UUPG v1 and its independently enabled global-engagement/frontier options exactly as the current filter behaves.
- [ ] 2.3 Implement the TypeScript row evaluator from the shared expression and replace the independent UUPG predicate in dataset filtering without changing visible results.
- [ ] 2.4 Implement trusted SQL compilation for named-filter expressions and extend the private-data-chat typed plan/schema to reference approved named-filter keys and options.
- [ ] 2.5 Add exhaustive truth-table tests for true, false, blank, and unsupported values plus fixture identity/count parity between table evaluation and local PostgreSQL.
- [ ] 2.6 Add stale version/checksum, unknown filter, invalid option, injection text, and policy-boundary rejection tests.

## 3. Result Completeness and Deterministic Evidence

- [ ] 3.1 Extend the compiled/executed query contract with mode, requested limit, returned count, matching count, `hasMore`, selected concepts, and applied named filters.
- [ ] 3.2 Add a bounded matching-count strategy for record queries, strip internal count columns, and preserve existing statement, cost, time, byte, row, connection, and concurrency limits.
- [ ] 3.3 Add broker invariants that reject inconsistent limit/count/completeness combinations before narration.
- [ ] 3.4 Build a typed evidence ledger for aggregate values, matching/returned counts, row cells, units, null meanings, dataset version, and query scope.
- [ ] 3.5 Render scalar summaries, matching-versus-returned wording, and fact bullets deterministically from evidence references; use deterministic fallback for unknown, altered, or scope-incompatible model claims.
- [ ] 3.6 Add signed, expiring, identity/session-bound turn-state evidence containing only redacted semantic/query/result summaries and checksums.
- [ ] 3.7 Add unit and integration regressions proving that 100 returned out of 103 is never stated as a total, even when user prose or prior assistant text claims otherwise.

## 4. Versioned Semantic-Context Snapshot

- [ ] 4.1 Extend the existing private reference-resource types/lifecycle for a `semantic-context-catalog` candidate without adding an external storage or vector service.
- [ ] 4.2 Add the contextual semantic-card schema with stable key, kind, dataset/grain, definition, aliases, type/unit/null metadata, allowed-value/resolver policy, metric/filter formula, typed dependencies/relationships, separately approved safe-join/resource-operation capabilities, examples/counterexamples, source/version/freshness lineage, sensitivity, stage audiences, retrieval tags, deterministic search text, content checksum, and query-authority classification.
- [ ] 4.3 Build candidate cards from the approved query catalog, field definitions, canonical aliases, field-source mappings, source priorities, source contracts, named filters, pipeline contracts, filter regions, active resource summaries, and a separately reviewed semantic-plan demonstration pool.
- [ ] 4.4 Exclude full country, ROP, PEID, PeopleID3, alias, priority, and engagement value payloads from semantic-card snapshots/model prompts; retain reviewed summaries, field/relationship definitions, and resolver/resource-operation metadata while serving complete ROP entry access only through the typed bounded adapter.
- [ ] 4.5 Add validation for blank/contradictory definitions, type/unit/null conflicts, duplicate aliases, unsupported markup/control text, instruction-like content, sensitivity, size limits, missing source versions, and authority widening.
- [ ] 4.6 Add candidate review, activation, rollback, checksum reuse, active-pointer health, and immutable source-version manifest behavior through the existing reference-resource operational surface.
- [ ] 4.7 Add Supabase migration/security tests for any extended private resource kinds or projections, including negative grants for `anon`, `authenticated`, `service_role`, and analytics roles.
- [ ] 4.8 Build zero-to-two-example retrieval cards from sanitized question-to-typed-plan fixtures only; exclude SQL/results/production text, enforce catalog compatibility, and prove grouped holdout isolation and duplicate/paraphrase rejection.
- [ ] 4.9 Define one versioned semantic definition package with structured-resource and human-guiding-document projections; generate documents from structured edits, parse supported document edits into candidate diffs, review both together, activate/rollback atomically, and add checksum-drift, ambiguous-parse, concurrent-conflict, authority-widening, and Blake-approval tests.

## 5. Benchmark-Selected Context Retrieval

- [ ] 5.1 Implement the checksum-bound exact concept/alias map and private PostgreSQL full-text baseline over deterministic contextual card text with stable ranking/tie-breaks.
- [ ] 5.2 Generate controlled retrieval views from the original utterance plus only verified current-view and prior-turn concept/evidence keys; add tests proving forged prose cannot rewrite retrieval.
- [ ] 5.3 Implement typed dependency expansion and set-wise coverage selection that pins exact/current-view evidence, includes required formula/filter/grain dependencies, prunes redundant/hard-negative cards, and asks for clarification when required evidence is incomplete.
- [ ] 5.4 Enforce pre-ranking dataset/audience/sensitivity/authority policy, at most six total items, at most two demonstrations, 8 KiB serialized context, stable ordering, and data-only serialization.
- [ ] 5.5 Keep large value domains behind typed deterministic resolvers/resource-query services, perform exact approved resolution before planning, pass only canonical match/ambiguity or bounded page state, and record exact version lineage; expose complete ROP traversal/filter/relationship metadata only through the separately approved catalogs and registries.
- [ ] 5.6 Add lexical retrieval tests for exact/alias/phrase/paraphrase ranking, multi-concept coverage, ambiguity, examples, excluded/conflicting entries, prompt/SQL-like content, stale snapshots, hard negatives, truncation, repeatability, and p95 performance.
- [ ] 5.7 Build a local-only Qwen3-Embedding-0.6B candidate on Samson with a fixed domain instruction and no credentials/tools; bind artifact/runtime/instruction/dimension, generate card embeddings only for reviewed snapshots, and store them in a private pgvector projection.
- [ ] 5.8 Implement exact pgvector similarity plus PostgreSQL full-text reciprocal-rank fusion without HNSW/IVFFlat, while preserving exact alias precedence and policy filtering before ranking.
- [ ] 5.9 Build the optional Qwen3-Reranker-0.6B candidate over only the bounded fused candidates and bind its artifact/runtime/instruction to the retriever policy.
- [ ] 5.10 Run the frozen lexical/hybrid/rerank bakeoff and report Recall@1/6, nDCG@6, MRR, required-set coverage, hard-negative/irrelevant-context rate, clarification/abstention, bytes, latency, memory, swap, and generative-Qwen queue/latency impact.
- [ ] 5.11 Select and document the smallest tier meeting every critical and material-gain gate; remove/leave undeployed dense components when they do not qualify, and require separate review before any approximate vector index.
- [ ] 5.12 Add active-pointer refresh, card/index checksum verification, lexical-confidence fallback, retryable dense/rerank failure behavior, rollback, drift, poisoning, lexical/dense disagreement, and cross-audience isolation tests.
- [ ] 5.13 Build a separate held-out ROP entry-search benchmark covering exact code/name, aliases, descriptions, place, language, geography, status, join issues, ambiguity, hard negatives, active-version filtering, and permission isolation; retain exact/lexical search unless optional hybrid entry retrieval materially improves it within the approved Samson envelope.

## 6. Complete Governed ROP Browsing, Filtering, and Relationships

- [ ] 6.1 Freeze the user-facing ROP scope and semantic authority map: complete standalone browse/search/list/lookup/count/continue, reviewed ROP1/ROP2/ROP25/ROP3 filter/group/sort fields, `people_group_to_bound_rop3`, geography operations, null/match semantics, and explicit exclusions for physical or unregistered joins.
- [ ] 6.2 Extend the typed decision/plan/result schemas with `resource_query` for `rop-codes`, reviewed operation enums, canonical query/detail keys, 25-row maximum pages, resource version, matching/returned counts, `hasMore`, and opaque continuation state; forbid arbitrary resource keys, expressions, SQL, and mutations.
- [ ] 6.3 Reuse the existing authenticated ROP entry/detail/search/count/download services and active persisted projection for standalone chat; preserve exact code/name precedence, stable ordering, all reviewed search fields, role checks, resource errors, and no generated-file fallback.
- [ ] 6.4 Add short-lived signed ROP continuation tokens bound to identity/session, exact resource version, normalized query, ordering, cursor, and expiry; add replay, tamper, cross-user, stale-version, duplicate/skip, and restart tests.
- [ ] 6.5 Extend the semantic query catalog with normalized `rop3_code`, reviewed ROP1/ROP2/ROP25/ROP3 code/name concepts, ROP3 status, place, language, source, join issue, and match status; define aliases, types, null meanings, operators, grouping/sort authority, explanatory-only descriptions, and deterministic name/code resolution.
- [ ] 6.6 Add an additive Supabase migration that normalizes primary `pg_rop3`/`PG_ROP3` into the read-only analytics projection and resolves the exact ROP version from dataset producer/forming-run reference-resource lineage; fail closed for missing, duplicate, stale, or inconsistent bindings and never fall back to the active pointer.
- [ ] 6.7 Add the server-owned `people_group_to_bound_rop3` relationship registry entry with many-to-one cardinality, trusted physical mapping, deterministic parameterized left relationship, approved column projection, automatic dependency selection, and rejection of model-authored keys/types/`ON` clauses.
- [ ] 6.8 Keep one-to-many ROP geography at an explicit `rop_geography` result grain and add a registered `EXISTS`-style primary-data geography filter; prohibit implicit flattening/grouping that could multiply people-group rows.
- [ ] 6.9 Implement the approved null-preserving behavior and typed match status for blank, malformed, inactive, unmatched, and join-issue ROP3 values; ensure explicit filters disclose their exclusion scope and never invent or silently repair classifications.
- [ ] 6.10 Add database grants/RLS/function-cost/index tests plus cardinality, active-version drift, bound-version reproducibility, null preservation, unmatched/inactive/parent-only rows, geography nonmultiplication, injection, pagination, export-link, and audit-redaction tests.
- [ ] 6.11 Render compact ROP resource pages, completeness wording, ambiguity choices, continuation, version label, and authenticated full-export action in chat; synchronize new ROP field/relationship/operation definitions with guiding documents through the reviewed semantic package.

## 7. Signed Current-View Handoff

- [ ] 7.1 Define the current-view context schema for approved dataset/version, filter registry/version, named-filter options, ordinary filters, sort, issue/expiry time, and identity/session binding; exclude client-authoritative counts.
- [ ] 7.2 Add a dedicated server-only context-signing secret and short-lived signing/verification helpers with tamper, replay, cross-user, expiry, and stale-version tests.
- [ ] 7.3 Add the same-origin guarded handoff endpoint that validates the canary identity, current primary dataset, supported filters/sorts, payload bounds, and registry/catalog versions.
- [ ] 7.4 Add **Ask Qwen about this view** to the approved primary dataset action surface and store the returned token/summary only in same-origin session storage.
- [ ] 7.5 Extend the chat request schema/client to include optional current-view and signed prior-turn tokens while retaining bounded message limits and forbidden-role rejection.
- [ ] 7.6 Render server-generated dataset/filter chips, UUPG criteria/blank semantics and null-preserving reason, context-aware quick questions, clear-context action, and return-to-view action without presenting the interactive filter as the Baseline UUPG pipeline.
- [ ] 7.7 Handle direct chat, invalid/stale/expired context, new chat, sign-out, and session closure without implying filters are active or persisting token/filter state.
- [ ] 7.8 Update route/component tests, accessibility assertions, route registry/smoke markers if needed, and targeted desktop/mobile UI journeys for handoff, chips, clear, stale, and unauthorized states.

## 8. Planner, Narrator, Resource Results, and Definition Answers

- [ ] 8.1 Assemble planner context from controlled retrieval views, deterministic resolver/resource-operation metadata, verified current/prior-turn state, typed dependency/relationship coverage, and at most two reviewed semantic-plan examples while retaining the full core query catalog and no compiler-only mappings.
- [ ] 8.2 Extend planner instructions/schema for named-filter selection, ROP resource-query decisions, approved ROP fields/relationship keys, context inheritance/override, count-versus-record intent, continuation, demonstration handling, and refusal/clarification when authority or version binding is incomplete.
- [ ] 8.3 Retrieve answer context only for compiled selected concepts, applied filters/relationships, resource result scope, and explicitly requested definitions; include result completeness and the typed evidence ledger.
- [ ] 8.4 Add grounded answers for reviewed Accelerate Global concepts/resources plus complete governed ROP browsing/filtering/relationships; preserve refusal for lifecycle mutations, physical/unregistered joins, unsupported data operations, off-topic questions, and snapshot/binding-unavailable requests.
- [ ] 8.5 Version and hash the planner prompt, answer prompt, plan/resource/evidence schemas, retriever policy and ordering, resource-operation allowlist, relationship registry, named-filter registry, semantic snapshot/index manifest, demonstration pool, compiler policy, generative model/runtime, and any selected embedding/rerank artifacts/instructions/dimensions/runtimes.
- [ ] 8.6 Update the application/Samson gateway contracts and unit tests while keeping HMAC, Cloudflare Access, semantic-context requirement, queue, timeout, size, replay, and single-slot controls intact.
- [ ] 8.7 Add deterministic fallback and normalized failure states for retrieval, resource paging, version binding, relationship/cardinality checks, context verification, evidence validation, matching-count, gateway, and database failures.
- [ ] 8.8 Evaluate retrieved-block/resource-result ordering and final instruction reinforcement against hard negatives on the pinned Qwen artifact; freeze the best safe ordering in the retriever/prompt policy.

## 9. Evaluation and Repository Verification

- [ ] 9.1 Run the frozen semantic-card and ROP entry-search holdouts and enforce/report exact Recall@1, held-out Recall@6, nDCG@6, MRR, required-set coverage, irrelevant/hard-negative rate, cross-audience/exclusion failures, clarification/abstention, context bytes, latency, and repeatability.
- [ ] 9.2 Expand planner cases for UUPG, current-view inheritance, controlled multi-turn rewriting, context override, definition questions, complete ROP browse/search/count/continue, ROP filters/groups/registered relationships, geography grain, version-binding failure, null preservation, physical/unregistered-join refusals, named-filter options, count/list challenges, retrieved examples, forged prior prose, and unsupported concepts.
- [ ] 9.3 Expand answer cases for complete/incomplete record and resource pages, 100-of-103 wording, ROP matching-versus-returned wording, evidence-reference validation, deterministic facts, UUPG/ROP null-preserving rationale, bound-versus-active ROP version explanation, guiding-document/resource conflicts, deliberate hard negatives, and off-topic refusal.
- [ ] 9.4 Expand end-to-end cases for signed Sudan+UUPG context, table/SQL count parity, ROP browse/filter/relationship/geography flows, stale/tampered/cross-user view and continuation state, active-version drift, context clearing, dense-service degradation when selected, and the exact production incident conversation.
- [ ] 9.5 Regenerate and review the full human-readable retrieval/planner/answer/resource/end-to-end inventory; do not run live model or production canary cases until the corpus, relevance labels, tier, and repetition count receive explicit approval.
- [ ] 9.6 Calibrate any RAGChecker/RAGAS/ARES-style automated diagnostics against the human-reviewed subset and keep them non-authoritative; preserve deterministic gold plans, resource results, compiled SQL/results, relationship/cardinality assertions, and evidence assertions as release gates.
- [ ] 9.7 Run direct unit/integration tests, `pnpm run verify:fast`, `pnpm run smoke:check`, targeted UI smoke, and local Supabase database-security/parity tests as required by `pnpm run verify:change`.
- [ ] 9.8 Run `pnpm run verify:change:run` on the final tracked implementation and fix every environment, test-gap, contract/harness, or product failure before closeout.
- [ ] 9.9 Verify implementation completeness/correctness/coherence against OpenSpec, sync the capability specs, archive the completed change, and run `pnpm run verify:ship:local` before release work.

## 10. Samson Evaluation and Canary Release

- [ ] 10.1 Export the exact approved planner/answer/retrieval/resource/relationship suites and pinned hashes to Samson without raw production prompts, values, rows, or credentials.
- [ ] 10.2 Run the approved semantic-card and ROP entry-search lexical/hybrid/rerank concurrency bakeoffs on Samson, capture sanitized resource/latency receipts, select the smallest passing tier for each domain, and leave unselected sidecars undeployed.
- [ ] 10.3 Run diagnostic generative-model evaluation, remediate genuine prompt/product failures without weakening rubrics, then run three clean temperature-zero repetitions for planner and answer tiers.
- [ ] 10.4 Run the explicitly approved bounded production end-to-end canary tier, including the exact 100/103/104 regression, ROP browse/filter/relationship cases, and selected retrieval degradation cases, and store only sanitized structural receipts.
- [ ] 10.5 Install rolling accepted prompt/schema/retriever/resource/relationship hashes in the gateway, keep `REQUIRE_SEMANTIC_CONTEXT=true`, and verify health, signed request, Access, replay, timeout, optional sidecar isolation, and one-slot generative capacity boundaries.
- [ ] 10.6 Configure the dedicated current-view/continuation signing secrets and feature flags in Vercel Production while retaining the exact administrator canary and disabled-by-default rollout.
- [ ] 10.7 Open a release PR, require App Quality, OpenSpec, UI Smoke, Database Security, and Dependency Audit, then ship through `pnpm ship --pr <number>` only after all gates pass.
- [ ] 10.8 Verify the live production dataset-to-chat handoff, UUPG definition/count parity, `showing 100 of 103` wording, complete ROP paging/export reachability, dataset-bound ROP filtering/relationship behavior, definition/example retrieval, off-topic refusal, console/runtime errors, and Release Health.
- [ ] 10.9 Remove previous gateway hashes only after the strict post-release canary passes; document rollback and monitor retrieval/resource latency, continuation/context failures, relationship binding/cardinality failures, grounding fallback, sidecar health, Samson headroom, queue pressure, and database timing before any audience expansion.
