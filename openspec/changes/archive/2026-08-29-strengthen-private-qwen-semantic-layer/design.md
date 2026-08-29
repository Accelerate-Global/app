## Context

The released private-data chat already has the essential security boundary: Qwen receives a strict JSON planning schema, never a database credential or SQL tool; the application validates the plan and compiles one parameterized `SELECT`; and Supabase executes it through the constrained `analytics_chat_reader` path. The remaining weakness is semantic, not infrastructural. `src/lib/private-data-chat/prompts.ts` currently lists identifiers but omits most definitions already represented in `catalog.ts`, source-forming contracts, field definitions, and reference resources. The deterministic suite in `evaluation-cases.ts` covers only seven questions.

The current pilot has one approved dataset and nine filterable fields, so a separate semantic platform, retrieval service, or vector database would add operational and security surface without improving catalog selection. The implementation must remain compatible with the existing Vercel-to-Cloudflare-to-Samson path and the existing Supabase authorization projection.

## Goals / Non-Goals

**Goals:**

- Give Qwen enough safe business meaning to select an exact typed plan reliably.
- Bind plans, compilation, provenance, and tests to one immutable catalog revision.
- Reuse existing canonical field/source/reference vocabulary without allowing mutable metadata to auto-expand Qwen's permissions.
- Resolve approved country aliases and codes deterministically before compilation, clarify ambiguity, and preserve unknown values as inert filters that may yield zero rows.
- Give final narration only the selected semantic definitions and bounded result.
- Establish broad deterministic regression cases and require fresh live-Qwen evidence for the changed AI contract.

**Non-Goals:**

- Model-written SQL, arbitrary schema discovery, database tools, free-form joins, or dynamic column exposure.
- New datasets, database migrations, RLS changes, role changes, UI changes, or provider configuration.
- A new runtime framework such as Cube, MetricFlow, Malloy, WrenAI, LangChain, TypeChat, or the Vercel AI SDK. The existing narrow HTTP gateway already supplies schema-constrained local inference.
- Semantic-vector retrieval for the current small catalog. The complete safe catalog fits comfortably in planning context.

## Decisions

### 1. Keep a typed semantic plan as the only model output

Qwen will continue to emit a business-level query object. It will never emit SQL or physical relation/column identifiers. The query object gains an exact `catalogVersion` literal so a stale model response cannot be compiled against a different catalog.

Generated SQL plus parsing was rejected because a parser can establish syntax but cannot prove authorization, business meaning, join safety, or value provenance. The existing compiler-by-construction has a much smaller attack surface and makes every user/model value an out-of-line parameter.

### 2. Split semantic metadata from compiler-only mappings

The versioned catalog remains server-owned and contains:

- dataset grain, description, sensitivity, provenance, and freshness semantics;
- field meaning, aliases, type, unit, null meaning, supported uses/operators, value-domain policy, and source metadata;
- metric meaning, business formula, unit, null behavior, compatible dimensions, and dependencies;
- explicitly empty join capabilities for the single-dataset pilot.

Prompt and answer renderers select only safe semantic properties. Physical view names, columns, and SQL expressions remain compiler-only and are tested not to appear in inference payloads.

### 3. Use a curated allowlist overlay with source reconciliation

The existing field-definition registry, source-forming contracts, and reference-resource keys provide canonical vocabulary and provenance. Catalog entries cite those canonical keys/contracts, and tests reconcile overlapping source-contract types. Definitions used in a model prompt remain reviewed code rather than live database text: a mutable or newly created field definition cannot silently become queryable or inject prompt content.

This is deliberate partial derivation. Existing metadata seeds labels, types, source identity, and value resources; the small overlay owns queryability, metric formulas, null semantics, sensitivity, and allowed operations.

### 4. Bind the snapshot with a deterministic checksum

The semantic snapshot has a human-readable v2 revision plus a SHA-256 checksum of canonical semantic metadata. A catalog test recomputes the checksum. Any metadata edit therefore requires an explicit revision/checksum update, which in turn triggers prompt/schema/compiler fixture updates and the live-Qwen release receipt.

### 5. Resolve controlled values outside Qwen and outside SQL

For country filters only, the application loads the active `country-territory-codes` resource after a schema-valid plan and before compilation. It builds an exact normalized alias/code index from active entries:

- one exact match becomes the canonical display name;
- multiple exact matches produce a deterministic clarification and no query;
- no match preserves the complete value as inert data so legitimate zero-result filters still execute;
- resource failure fails closed for that controlled-value query.

The full country catalog is not sent to Qwen, and the application never performs unrestricted `DISTINCT` discovery. Other fields remain typed open or boolean domains until an approved canonical resource exists.

### 6. Generate compact planner and answer contexts from the same snapshot

The planner receives the complete safe nine-field catalog because retrieval would cost more than it saves at this size. The answer call receives only definitions for selected fields/metrics, plus the already bounded rows and provenance. Result content remains untrusted data and cannot alter instructions.

### 7. Treat evaluation as an executable contract

The sanitized suite expands across supported aggregation/records, synonyms, geography aliases, null/boundary behavior, ambiguity, unsupported concepts, multi-turn resolution, mutations, prompt injection, and SQL-looking values. Every golden query must validate, compile, select the expected keys, keep values out of SQL, and carry the current catalog revision. Local Supabase integration continues to prove execution/authorization where the repo gate selects it. The changed prompt/schema/catalog/compiler/fixtures require a three-run temperature-zero receipt against the pinned Samson model before release.

## Risks / Trade-offs

- **[Catalog definitions drift from business meaning]** → Checksum/revision discipline, source-provenance reconciliation, golden cases, and release receipts make drift reviewable and fail closed.
- **[Mutable field definitions contain unsafe or inaccurate text]** → They are references for curation and reconciliation only; live definition text is never injected into Qwen context.
- **[Country aliases change independently of the static catalog]** → Resolution uses the active versioned resource and canonical display name at request time; the model sees only the resource policy, not its values.
- **[An alias is ambiguous]** → Query execution stops and returns a focused deterministic clarification.
- **[Unknown country text is malicious-looking]** → It remains an out-of-line parameter. Unknown values are not interpolated, fuzzy-matched, or treated as instructions.
- **[More datasets make the full catalog too large]** → Add deterministic catalog selection and named join capabilities only when measured catalog growth requires them; no speculative retrieval service is introduced now.
- **[New metadata increases prompt tokens]** → The context is compact, contains only nine fields/four metrics, and stays within the gateway's existing bounded request and output limits.

## Migration Plan

1. Introduce catalog v2 metadata, checksum tests, renderers, and exact version binding.
2. Add deterministic country-value resolution and selected answer context with direct unit tests.
3. Expand evaluation cases and integration expectations.
4. Run the repo-selected change gate and strict OpenSpec validation.
5. Run the pinned real-Qwen suite for three deterministic repetitions and retain the hash-verified receipt.
6. Archive the OpenSpec change, run ship-local, release through the existing PR workflow, and confirm production health.

Rollback is an application rollback to the prior release. No Supabase object, credential, Cloudflare resource, Vercel variable, or user data needs to be reverted.

## Open Questions

None for the one-dataset pilot. Cross-dataset relationships, named safe joins, and catalog retrieval remain future changes that require their own approved specs and database projections.
