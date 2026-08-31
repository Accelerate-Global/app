## 1. Planning, Definitions, and Incident Baseline

- [ ] 1.1 Run `pnpm run verify:change` and `pnpm run task:kickoff` with ownership covering private-data-chat, dataset filtering/view UI, reference resources, migrations, OpenSpec, and UI journeys; record the required commands, targeted smoke subset, and local Supabase requirement before implementation.
- [ ] 1.2 Add a sanitized incident fixture representing 180 Sudan rows, 103 frontier matches, 104 authoritative UUPG matches, 67 explicit dual-criterion matches, and a 100-row record limit; preserve no production identifiers or rows.
- [ ] 1.3 Record the authoritative UUPG v1 definition from the current filter, including enabled criteria and blank matching, and obtain product review of the user-facing definition text.
- [ ] 1.4 Reconcile the conflicting global-engagement field-definition wording with forming conversion, source contracts, and the approved boolean direction before making that entry retrieval-eligible.
- [ ] 1.5 Generate the proposed planner, answer, retrieval, current-view, completeness, and adversarial evaluation corpus for human review without calling Qwen, Samson, Supabase production, Cloudflare, or Vercel.

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
- [ ] 4.2 Add the semantic-entry schema with stable key, kind, scope, definition, aliases, type/unit/null metadata, filter summary, source/version lineage, sensitivity, stage audiences, retrieval tags, content checksum, and query-authority classification.
- [ ] 4.3 Build candidate entries from the approved query catalog, field definitions, canonical aliases, field-source mappings, source priorities, source contracts, named filters, pipeline contracts, filter regions, and active resource summaries.
- [ ] 4.4 Exclude full country, ROP, PEID, PeopleID3, alias, priority, and engagement payload entries; retain only reviewed summaries and resolver capability metadata.
- [ ] 4.5 Add validation for blank/contradictory definitions, type/unit/null conflicts, duplicate aliases, unsupported markup/control text, instruction-like content, sensitivity, size limits, missing source versions, and authority widening.
- [ ] 4.6 Add candidate review, activation, rollback, checksum reuse, active-pointer health, and immutable source-version manifest behavior through the existing reference-resource operational surface.
- [ ] 4.7 Add Supabase migration/security tests for any extended private resource kinds or projections, including negative grants for `anon`, `authenticated`, `service_role`, and analytics roles.

## 5. Deterministic Retrieval

- [ ] 5.1 Implement an immutable in-process index keyed by active semantic snapshot checksum with exact concept/alias lookup and deterministic weighted lexical scoring.
- [ ] 5.2 Enforce dataset scope, sensitivity, authority classification, planner/answer audience, six-entry limit, 8 KiB context budget, stable tie-breaks, and safe structured serialization.
- [ ] 5.3 Add cache refresh by active pointer/version and bounded retryable failure behavior without using mutable metadata as a fallback.
- [ ] 5.4 Keep large value domains behind deterministic resource resolvers and record exact active-version lineage for every successful resolution.
- [ ] 5.5 Add retrieval tests for exact/alias/lexical ranking, ambiguity, excluded entries, conflicting entries, prompt/SQL-like content, stale snapshots, context truncation, repeatability, and p95 performance target.
- [ ] 5.6 Benchmark deterministic retrieval against the approved question corpus and document whether embeddings add material recall before considering a separate vector phase.

## 6. Signed Current-View Handoff

- [ ] 6.1 Define the current-view context schema for approved dataset/version, filter registry/version, named-filter options, ordinary filters, sort, issue/expiry time, and identity/session binding; exclude client-authoritative counts.
- [ ] 6.2 Add a dedicated server-only context-signing secret and short-lived signing/verification helpers with tamper, replay, cross-user, expiry, and stale-version tests.
- [ ] 6.3 Add the same-origin guarded handoff endpoint that validates the canary identity, current primary dataset, supported filters/sorts, payload bounds, and registry/catalog versions.
- [ ] 6.4 Add **Ask Qwen about this view** to the approved primary dataset action surface and store the returned token/summary only in same-origin session storage.
- [ ] 6.5 Extend the chat request schema/client to include optional current-view and signed prior-turn tokens while retaining bounded message limits and forbidden-role rejection.
- [ ] 6.6 Render server-generated dataset/filter chips, UUPG criteria/blank semantics, context-aware quick questions, clear-context action, and return-to-view action.
- [ ] 6.7 Handle direct chat, invalid/stale/expired context, new chat, sign-out, and session closure without implying filters are active or persisting token/filter state.
- [ ] 6.8 Update route/component tests, accessibility assertions, route registry/smoke markers if needed, and targeted desktop/mobile UI journeys for handoff, chips, clear, stale, and unauthorized states.

## 7. Planner, Narrator, and Definition Answers

- [ ] 7.1 Retrieve planner context from the latest bounded conversation, verified current view, and verified prior-turn evidence while retaining the full core query catalog and no compiler-only mappings.
- [ ] 7.2 Extend planner instructions/schema for named-filter selection, context inheritance/override, count-versus-record intent, and refusal when retrieved explanatory material lacks query authority.
- [ ] 7.3 Retrieve answer context only for compiled selected concepts, applied named filters, and explicitly requested definitions; include result completeness and the typed evidence ledger.
- [ ] 7.4 Add grounded definition-only answers for reviewed Accelerate Global concepts/resources and preserve refusal for off-topic, unsupported, or snapshot-unavailable questions.
- [ ] 7.5 Version and hash the planner prompt, answer prompt, plan schema, answer/evidence schema, retriever policy, named-filter registry, semantic snapshot, compiler policy, model artifact, and runtime revision.
- [ ] 7.6 Update the application/Samson gateway contracts and unit tests while keeping HMAC, Cloudflare Access, semantic-context requirement, queue, timeout, size, replay, and single-slot controls intact.
- [ ] 7.7 Add deterministic fallback and normalized failure states for retrieval, context verification, evidence validation, matching-count, gateway, and database failures.

## 8. Evaluation and Repository Verification

- [ ] 8.1 Expand planner cases for UUPG, current-view inheritance, context override, definition-only questions, named-filter options, count/list challenges, forged prior prose, and unsupported retrieval concepts.
- [ ] 8.2 Expand answer cases for complete/incomplete record pages, 100-of-103 wording, evidence-reference validation, deterministic facts, UUPG explanation, conflicting metadata, and off-topic refusal.
- [ ] 8.3 Expand end-to-end cases for signed Sudan+UUPG context, table/SQL count parity, stale/tampered/cross-user context, context clearing, and exact production incident conversation.
- [ ] 8.4 Regenerate and review the full human-readable evaluation inventory; do not run live model or production canary cases until the corpus/tier/repetition count receive explicit approval.
- [ ] 8.5 Run direct unit/integration tests, `pnpm run verify:fast`, `pnpm run smoke:check`, targeted UI smoke, and local Supabase database-security/parity tests as required by `pnpm run verify:change`.
- [ ] 8.6 Run `pnpm run verify:change:run` on the final tracked implementation and fix every environment, test-gap, contract/harness, or product failure before closeout.
- [ ] 8.7 Verify implementation completeness/correctness/coherence against OpenSpec, sync the capability specs, archive the completed change, and run `pnpm run verify:ship:local` before release work.

## 9. Samson Evaluation and Canary Release

- [ ] 9.1 Export the exact approved planner/answer/retrieval suites and pinned hashes to Samson without raw production prompts, values, rows, or credentials.
- [ ] 9.2 Run diagnostic model-only evaluation, remediate genuine prompt/product failures without weakening rubrics, then run three clean temperature-zero repetitions for planner and answer tiers.
- [ ] 9.3 Run the explicitly approved bounded production end-to-end canary tier, including the exact 100/103/104 regression, and store only sanitized structural receipts.
- [ ] 9.4 Install rolling accepted prompt/schema hashes in the gateway, keep `REQUIRE_SEMANTIC_CONTEXT=true`, and verify health, signed request, Access, replay, timeout, and one-slot capacity boundaries.
- [ ] 9.5 Configure the dedicated current-view signing secret and feature flag in Vercel Production while retaining the exact administrator canary and disabled-by-default rollout.
- [ ] 9.6 Open a release PR, require App Quality, OpenSpec, UI Smoke, Database Security, and Dependency Audit, then ship through `pnpm ship --pr <number>` only after all gates pass.
- [ ] 9.7 Verify the live production dataset-to-chat handoff, UUPG definition/count parity, `showing 100 of 103` wording, definition retrieval, off-topic refusal, console/runtime errors, and Release Health.
- [ ] 9.8 Remove previous gateway prompt/schema hashes only after the strict post-release canary passes; document rollback and monitor retrieval latency, context failures, grounding fallback, queue pressure, and database timing before any audience expansion.
