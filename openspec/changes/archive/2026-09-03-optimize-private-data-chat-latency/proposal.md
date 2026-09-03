## Why

Private Qwen data chat currently serializes a long planner inference and a second grounded-answer inference for every approved analytical query. Live Samson evidence shows that the narrator both adds roughly one model call of latency and displaces the single-slot planner KV cache, so exact deterministic results can take well over a minute even though semantic retrieval and read-only query execution are comparatively small.

## What Changes

- Establish reproducible cold and warm phase measurements for semantic retrieval, planner prompt ingestion and generation, deterministic query execution, grounded-answer generation, relay/runtime overhead, and non-queuing admission behavior.
- Return the existing evidence-validated deterministic rendering directly for approved analytical query results whose bounded result contract is already sufficient, avoiding an unnecessary second inference without bypassing planning, validation, value resolution, compilation, read-only execution, completeness checks, or provenance.
- Retain the grounded-answer endpoint and frozen answer evaluation as a compatibility and fallback capability; do not change the pinned Qwen model, planner/answer prompts, schemas, catalog, compiler policy, or evaluation rubrics in this change.
- Document the measured Samson VM/LXC/runtime state, before/after p50 and p95 evidence, production canary results, and operational rollback.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `private-data-chat`: Approved deterministic analytical results may complete without a second model inference while preserving exact facts, completeness language, provenance, and signed turn state.
- `private-model-gateway`: Latency qualification distinguishes model prompt ingestion, generation, relay overhead, cold/warm state, and busy rejection without weakening the single-slot containment boundary.

## Impact

- Primary code: `src/lib/private-data-chat/orchestrator.ts`, its focused tests, and latency/evaluation tooling under `scripts/`.
- Operations: read-only inspection of Samson VM 200, tunnel LXC 105, Vercel runtime evidence, and the existing Cloudflare relay; any production runtime mutation remains separately controlled and reversible.
- Auth and admin permissions: unchanged. The exact administrator canary and disabled-first feature gate remain mandatory.
- Data integrity and Supabase: no schema, migration, RLS, credential, query-authority, or write-path change. Deterministic query execution continues through the constrained read-only analytics role.
- API contracts: existing streamed chat message shapes and gateway plan/answer endpoints remain compatible.
- Vercel deployment: ordinary Git/PR release flow only; no function-duration weakening.
- UI smoke coverage: unchanged because no page or browser surface changes.
- Non-goals: changing the Qwen model, absorbing the concurrent South Asia/India geography fix, weakening off-topic controls or frozen rubrics, introducing dense retrieval/reranking, or increasing model parallelism beyond verified Samson capacity.
