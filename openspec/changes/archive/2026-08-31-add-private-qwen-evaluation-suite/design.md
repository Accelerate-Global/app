## Context

Private data chat currently has a checksum-bound semantic catalog, strict planner and answer schemas, a deterministic parameterized compiler, a read-only broker, and 23 sanitized golden planner cases. The existing cases are appropriate as a compact release baseline, but they do not characterize the breadth of language, conversation, grounding, and adversarial behavior expected from real administrators. Live Qwen evaluation is deliberately outside normal CI because Samson is single-slot local infrastructure and each repeated case consumes meaningful inference time.

The evaluation suite therefore needs two properties that are often in tension: it must be large enough to expose capability gaps, while remaining transparent enough that a human can review every proposed interaction before any live model or data access occurs.

## Goals / Non-Goals

**Goals:**

- Provide at least 200 explicitly reviewable cases across planning, multi-turn conversation, grounded narration, controlled values, unsupported requests, security boundaries, and end-to-end read-only behavior.
- Preserve the existing 23 golden cases as a compatibility baseline.
- Separate smoke, core, and extended execution tiers so later live runs can match the available time and risk.
- Score structured semantics and grounded facts deterministically rather than requiring another LLM judge.
- Generate one deterministic Markdown review inventory containing every prompt, preceding turn, fixture, expected decision, and rubric.
- Guarantee that corpus validation and review generation perform no network or database access.

**Non-Goals:**

- Change the semantic catalog, compiler, broker, chat API payload schema, or UI. Planner/answer wording and gateway hash pins may change only to remediate a demonstrated evaluation defect.
- Add a live-model call to CI or automatically execute the corpus as part of repository verification.
- Commit production query results, private dataset samples, credentials, private endpoint details, or user conversation text. Public application identity and credentials-free durable receipt locations may be documented operationally.
- Judge prose style through semantic similarity or a second hosted model.

## Decisions

### Keep the compact release corpus and add a separate capability suite

The existing `PRIVATE_DATA_CHAT_EVALUATION_CASES` remains unchanged and is imported as the compatibility baseline. A separate versioned capability suite wraps those cases and adds broader planner, conversation, answer, and end-to-end definitions. This avoids silently changing the evidence behind the existing v3 receipt while allowing a much larger v4 review corpus.

Alternative considered: directly grow the existing array. Rejected because it would blur the distinction between the already-pinned receipt and the newly proposed cases, and a single monolithic file would be difficult to review.

### Use three explicit evaluation kinds

The corpus distinguishes:

1. `planner` cases: user/assistant message history plus an exact catalog-bound semantic decision and, for queries, expected compiled selected keys and parameters.
2. `answer` cases: a question, synthetic bounded rows/provenance, selected semantic context, exact expected structured facts, and required/forbidden narration claims.
3. `end-to-end` cases: read-only production-candidate questions with structural assertions such as decision class, bounded row count, ordering, provenance, and null handling rather than mutable private values.

This separation isolates model interpretation, narration, and full-path behavior so a failure can be attributed instead of producing one opaque pass rate.

Alternative considered: score only final natural-language answers. Rejected because a plausible answer can conceal a wrong plan, unsafe query, or fabricated fact.

### Curate capability matrices and expand only controlled paraphrase families

Cases are authored as explicit capability matrices with stable identifiers, rationales, tags, and expectations. Small helper factories may expand reviewed paraphrase arrays where the semantic expectation is intentionally identical. The generated review artifact enumerates every expansion, so programmatic generation cannot hide a prompt from reviewers.

Alternative considered: automatically generate prompts with an LLM. Rejected because it would add another model dependency and make the proposed test corpus nondeterministic.

### Compare semantics, not free-form planner rationale

Planner scoring treats the structured decision and query contract as normative while requiring the free-form `reason` to remain present and bounded. It does not require exact wording for the reason. Clarification and refusal cases define required intent phrases and forbidden claims rather than a single exact sentence.

Alternative considered: deep-equal the entire model response. Rejected because harmless prose variation would create false failures without improving query safety or correctness.

### Use synthetic answer fixtures and property-based end-to-end assertions

Grounded-answer fixtures use obviously synthetic people identifiers, names, counts, percentages, timestamps, and UUIDs. They exercise nulls, zeros, large values, empty rows, untrusted text in results, ordering, and units without copying production data. End-to-end cases avoid hard-coding private values and instead assert bounded, typed, provenance-bearing behavior.

Alternative considered: snapshot production rows into the repository. Rejected because values can drift and would widen private-data retention.

### Make review generation and static validation network-inert

The suite module is pure data plus deterministic helpers. Static validation checks uniqueness, tier/capability coverage, schema validity, current catalog version, compiler output, fixture bounds, sanitization, and review-document determinism. It does not import the HTTP gateway, database broker, Supabase client, or environment configuration. The review exporter writes Markdown only from in-memory definitions.

### Stage later live execution by cumulative tier

- `smoke`: fastest contract and safety signal.
- `core`: representative breadth suitable for ordinary candidate evaluation.
- `extended`: the full capability and adversarial suite.

The review document reports case and inference-call counts per tier and recommends one repetition for initial diagnostics, followed by repeated runs only after failures are understood. Live execution remains a separate, explicitly approved operation.

## Risks / Trade-offs

- **Risk: a large count creates shallow duplicate coverage** → Require stable capability tags, per-capability minimums, rationales, and duplicate-question detection; paraphrases are grouped visibly in the review report.
- **Risk: exact semantic expectations overconstrain legitimate plans** → Compare the decision/query contract and compiled semantics, not free-form reason wording; use clarification rubrics for wording flexibility.
- **Risk: mutable production data makes end-to-end expectations brittle** → Use synthetic fixtures for exact answer scoring and property assertions for production-candidate cases.
- **Risk: full execution is slow on single-slot Samson** → Publish cumulative tiers and estimated inference counts before execution; never attach live runs to normal CI.
- **Risk: generated Markdown drifts from source definitions** → Verify the committed review artifact byte-for-byte against deterministic generation.
- **Risk: a test prompt accidentally includes real sensitive content** → Reject credential-like patterns, production emails, known infrastructure addresses, and non-synthetic fixture identifiers during static validation.

## Migration Plan

1. Add the versioned suite types, curated case matrices, static validators, and deterministic review renderer.
2. Generate and commit the complete review inventory.
3. Run only network-inert repository verification and leave the OpenSpec change active for user review.
4. Following the user's explicit approval on 2026-08-30, export the extended tier to the isolated Samson evaluator, run one diagnostic repetition, review failures, then run three clean receipt repetitions.
5. Run the separately approved 24 read-only end-to-end cases three times through the production canary path and retain only structural/provenance evidence.
6. Verify, sync, archive, merge, and complete release health after all approved receipts pass.

There is no database migration or Cloudflare topology change. Before a prompt-changing production canary, the Samson gateway temporarily accepts the new and previous prompt hashes, the candidate Vercel deployment is promoted, and the prior deployment and root-only gateway environment backup provide rollback. After release health passes, the previous hashes are removed so the strict single-contract gateway posture is restored. The evaluation-suite files themselves remain removable without data migration.

## Approved Execution Decision

- **Tier:** extended (all 306 cases).
- **End-to-end:** included (all 24 read-only cases).
- **Repetitions:** one model-only diagnostic pass followed by three clean model-only repetitions; three end-to-end repetitions.
- **Completion:** remediate genuine product or corpus defects, preserve hash-bound receipts, archive the change, merge the PR, and complete deployment health.
