## 1. Evaluation contract

- [x] 1.1 Define versioned evaluation kinds, tiers, capabilities, risks, and deterministic scoring rubrics without importing network or database clients.
- [x] 1.2 Wrap all 23 existing v3 golden planner cases as a compatibility baseline without changing their inputs or expected plans.

## 2. Planner and conversation corpus

- [x] 2.1 Add curated supported-query and paraphrase matrices covering every approved metric, record field, filter type, operator, sort, limit, alias, and null boundary.
- [x] 2.2 Add focused clarification, unsupported-concept, controlled-value, and multi-turn conversation cases.
- [x] 2.3 Add mutation, export, credential, prompt-exfiltration, instruction-in-value, Unicode, SQL-looking, and other adversarial planner cases.

## 3. Grounded answer and full-path corpus

- [x] 3.1 Add synthetic grounded-answer fixtures covering counts, units, percentages, nulls, zeros, empty rows, ordering, large values, untrusted result text, and bounded provenance.
- [x] 3.2 Add read-only end-to-end candidate questions with structural assertions that do not commit mutable private values.
- [x] 3.3 Confirm the complete suite contains at least 200 cases with cumulative smoke, core, and extended tiers.

## 4. Static validation and review output

- [x] 4.1 Add direct static tests for unique IDs and prompts, coverage quotas, schema validity, active catalog version, deterministic compilation, fixture sanitization, and no network-bearing imports.
- [x] 4.2 Implement a deterministic Markdown review renderer that enumerates every expanded case and estimates later inference volume.
- [x] 4.3 Generate and commit the complete review inventory, then verify byte-for-byte parity with the structured suite.

## 5. Documentation and specification

- [x] 5.1 Document review workflow, execution tiers, scoring interpretation, and the explicit prohibition on live execution before approval.
- [x] 5.2 Run `pnpm run verify:change` after implementation and satisfy every reported required test or contract update without invoking live Qwen or production data.
- [x] 5.3 Run strict OpenSpec validation and keep the change active for user review rather than archiving or releasing it.

## 6. Network-inert verification

- [x] 6.1 Run the direct evaluation-suite static tests and confirm they make no gateway, HTTP, Supabase, or database calls.
- [x] 6.2 Run `pnpm run verify:change:run` as the terminal repository gate while leaving all live evaluation cases unexecuted.
- [x] 6.3 Confirm local Supabase and Docker services were not started by this work, or stop and clean them if a required repository gate starts them.

## 7. Approved live model evaluation

- [x] 7.1 Export the full planner and synthetic-answer corpus with exact prompt, schema, catalog, compiler, suite, model, and runtime hashes.
- [x] 7.2 Add a network-isolated Samson evaluator with deterministic plan, compilation, text-rubric, fact-grounding, and receipt scoring.
- [x] 7.3 Upload the reviewed bundle to Samson and run one full diagnostic repetition against the pinned local Qwen model.
- [x] 7.4 Classify and remediate every diagnostic failure as corpus, scorer, prompt, model, or product behavior, then revalidate the changed candidate.
- [x] 7.5 Run three clean full model-only repetitions and preserve the hash-bound planner and answer receipts.

## 8. Approved production canary evaluation

- [x] 8.1 Prepare a bounded browser-driven evaluator for the 24 approval-gated end-to-end cases without reading browser credentials or retaining private result rows.
- [x] 8.2 Run all 24 end-to-end cases three times through the approved production canary and score decision, provenance, selected concepts, bounds, ordering, null behavior, and text rubrics.
- [x] 8.3 Preserve a sanitized end-to-end receipt containing only structural outcomes, query identifiers, catalog revisions, timing, and failure classifications.

## 9. Final verification and release

- [x] 9.1 Update the v4 evaluation documentation with final counts, hashes, latency, and receipt locations.
- [x] 9.2 Verify implementation completeness, correctness, and design coherence against this OpenSpec change with no unresolved critical or warning findings.
- [x] 9.3 Sync the semantic-analytics-query delta specification and archive the completed OpenSpec change.

## Post-archive release follow-through

- Run the ship-local gate, create and merge the pull request, and verify production deployment health.
- Remove temporary credentials-free runners, stop any repo-local services, reclaim transient build cache, and leave durable evidence and repository state clean.
