## Context

Production private data chat uses one CPU-only llama.cpp slot on Samson VM 200. An analytical turn currently performs reviewed semantic retrieval, one typed planner inference, deterministic value resolution/compilation, a constrained read-only Supabase query, answer-context retrieval, and a second Qwen inference before the evidence renderer validates and prepends the deterministic answer.

Live inspection on 2026-09-02/03 found VM 200 healthy with 12 vCPUs, 40 GiB RAM, no swap, roughly 17 GiB available memory, and a 22.5 GiB model-service peak. The tunnel is a separate healthy 512 MiB unprivileged LXC. A production scalar canary spent 43.9 seconds on planner prompt ingestion, 18.4 seconds on planner generation, roughly 5 seconds crossing the application/query handoff, then 49.7 seconds on answer prompt ingestion and 4.2 seconds on answer generation. The narrator also replaces the planner's single-slot KV prefix, so the following planner cannot fully reuse it.

The planner prompt is 30,509 characters and its strict JSON schema is 6,429 bytes. The frozen model suite already proves this exact prompt/schema/model contract. Semantic retrieval is independently bounded to six cards/8 KiB and measured at 1.24 ms p95 in-process; dense and reranking alternatives remain rejected for quality/capacity reasons.

## Goals / Non-Goals

**Goals:**

- Remove the unnecessary second inference from deterministic analytical-query turns.
- Preserve exact typed planning, validation, compilation, read-only execution, completeness, evidence validation, provenance, signed turn state, and off-topic behavior.
- Preserve the pinned model, prompts, response schemas, runtime contract, and frozen evaluation rubrics.
- Record reproducible before/after cold and warm latency evidence by phase and include busy/queue and VM/LXC capacity evidence.

**Non-Goals:**

- Changing Qwen, shortening the reviewed planner contract, altering token limits, or weakening schema-constrained planning.
- Adding parallel model slots, dense retrieval, reranking, a hosted model/vector store, or a second model process.
- Changing Supabase schema/RLS, authentication, canary scope, Cloudflare Access/VPC topology, or Vercel duration limits.
- Modifying or duplicating the concurrent South Asia/India geography work.

## Decisions

1. **Deterministically render every validated analytical query result.** After the typed planner, deterministic compiler, and read-only broker succeed, the existing evidence renderer already produces the authoritative answer and bounded facts. The orchestrator will return that rendering directly and will not call the grounded-answer endpoint. Resource operations already follow this pattern; clarification, reviewed-definition, and refusal decisions still use the planner result. Keeping conditional narrator heuristics was rejected because every analytical result already shares the same validated result contract and a heuristic would retain cache displacement and latency unpredictability.

2. **Keep the grounded-answer contract and frozen answer suite.** The gateway endpoint, prompt, schema, and evaluator remain intact as a compatibility/fallback capability. This avoids a breaking gateway deployment and preserves independent evidence that Qwen can narrate bounded synthetic rows if a future reviewed workflow requires it.

3. **Do not tune the model runtime in this PR.** The current server uses one 16,384-token slot, eight generation threads, twelve batch threads, a 2,048-token batch, and a 512-token microbatch. Adding a second slot would halve usable context below the observed 9,409-token planner request or consume unsafe memory; a second server would exceed available memory. Thread changes cannot be isolated without interrupting the only production model and would not remove the dominant serial narrator work. The safest change is architectural call elimination.

4. **Treat the existing SSE stage boundaries and llama.cpp timing logs as the phase clock.** Production canaries observe time to `interpreting`, `validating`, `querying`, `explaining`, and final message; llama.cpp supplies prompt-eval and generation timings. Cloudflare Worker duration is compared with llama total time, Vercel request timestamps identify ingress, and broker audit `elapsed_ms` remains the deterministic-query timing. Receipts contain timing, counts, hashes, and statuses only—never prompts, values, rows, cookies, or credentials.

5. **Keep non-queuing admission.** The gateway's one-slot semaphore continues to reject concurrent work with 429 rather than creating an unbounded queue. Queue evidence is therefore busy-rejection latency and count, not wait time.

## Risks / Trade-offs

- **[Risk] Deterministic answers are terser than Qwen narration.** → The response still contains the authoritative metric/count/completeness sentence plus up to 20 bounded fact rows, which is the only content the evidence validator could guarantee. Frozen production rubrics must pass unchanged.
- **[Risk] A future result shape may need prose synthesis.** → Keep the answer gateway/evaluator and require an explicit reviewed opt-in rather than silently restoring narration for all queries.
- **[Risk] Cold planner latency remains high after a model restart.** → Preserve the bounded timeout and measure cold separately. This PR prioritizes the much more common warm path without introducing a privileged slot-control API or boot-time synthetic inference.
- **[Risk] Provider telemetry is incomplete.** → Correlate Vercel request timestamps, Worker logs, gateway/model logs, SSE stages, and broker audit; call out any unavailable provider view rather than inferring false precision.

## Migration Plan

Deploy through the separate PR after local verification and unchanged frozen model checks. Run the exact one-user read-only production canary before expansion and compare phase p50/p95 against the baseline. Rollback is the prior application commit; no database, Cloudflare, Samson, or secret rollback is required because their contracts do not change.

## Open Questions

None. Boot-time planner prewarming may be evaluated separately if cold-start frequency becomes material; it is not required to remove the dominant warm-path narrator cost.
