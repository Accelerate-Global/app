# Private Qwen data-chat latency qualification v1

Captured on 2026-09-02/03 against the production Qwen 3.6 runtime on Samson VM
200, tunnel LXC 105, the Access-protected Cloudflare Worker/VPC path, and the
current Vercel production deployment. Measurements retain timings, counts,
paths, statuses, and hashes only. They do not retain prompts, conversation text,
model output, rows, credentials, authorization headers, cookies, or raw provider
errors.

## Decision

Validated analytical query results return through the existing deterministic
evidence renderer without a grounded-answer Qwen call. Planning remains a
schema-constrained Qwen inference; value resolution, the compiler, read-only
broker, completeness checks, signed turn state, provenance, retrieval/off-topic
controls, and frozen rubrics remain unchanged. The grounded-answer endpoint and
its frozen synthetic evaluation remain available as a compatibility capability.

This is the highest-impact safe reduction because one narrator call adds tens of
seconds and replaces the planner prefix in the only KV slot. Prompt shortening,
model changes, additional slots, dense retrieval, reranking, and unmeasured CPU
thread changes were rejected for this change.

## Before evidence

The sanitized journal correlation covers 146 successful production analytical
plan-to-answer pairs observed since 2026-09-01. It pairs each gateway completion
with the nearest llama.cpp task completion and models end-to-end time as planner
model work plus deterministic/provider handoff plus answer model work. It
excludes initial browser/Vercel ingress and final SSE delivery, so it is slightly
lower than user-visible wall time.

| Phase | p50 | p95 |
| --- | ---: | ---: |
| Planner prompt ingestion | 45.30 s | 52.06 s |
| Planner generation | 22.48 s | 30.51 s |
| Planner total | 68.03 s | 81.30 s |
| Deterministic/provider handoff and query | 3.02 s | 6.52 s |
| Grounded-answer prompt ingestion | 8.01 s | 53.83 s |
| Grounded-answer generation | 4.76 s | 48.83 s |
| Grounded-answer total | 25.98 s | 64.78 s |
| Modeled analytical end to end | 95.53 s | 145.86 s |

A fresh scalar production canary independently showed the slow cache-displaced
shape: 43.93 s planner prompt ingestion, 18.37 s planner generation, roughly
5 s of application/query handoff, 49.70 s answer prompt ingestion, and 4.21 s
answer generation. User-visible completion was about two minutes.

The active planner system prompt is 30,509 characters; its strict response
schema is 6,429 serialized bytes. The production contextual request observed by
llama.cpp contained 9,409 tokens and evaluated 2,592 after partial reuse. The
reviewed-context cap remains six cards and 8 KiB. Frozen exact/lexical retrieval
is 1.24 ms p95 in-process; it is not a material contributor.

## After evidence

The candidate's steady-state model path was measured with ten consecutive
planner-only calls against the exact pinned v5 prompt/schema/model. Because no
narrator displaces the slot, 6,653 of 6,657 prompt tokens were reused on every
measured call.

| Phase | p50 | p95 |
| --- | ---: | ---: |
| Planner prompt ingestion | 0.17 s | 0.18 s |
| Planner generation | 22.68 s | 24.05 s |
| Planner wall time | 22.87 s | 24.24 s |
| Historical deterministic/provider handoff | 3.02 s | 6.52 s |
| Expected warm analytical end to end | about 25.9 s | about 30.8 s |

The expected end-to-end row is a phase composition, not a deployed production
claim: Vercel production secrets are non-exportable and the candidate must not
bypass the separate PR by deploying directly to production. The complete
post-deploy one-user canary must replace that estimate with measured SSE p50/p95
before release acceptance or expansion.

Against the observed production distribution, the composed warm path removes
about 69.6 seconds at p50 (73%) and 115.1 seconds at p95 (79%). Deterministic
rendering itself remains sub-millisecond in focused tests; the table conservatively
retains the historical handoff/query phase rather than assuming it disappears.

## Cold, edge, queue, and capacity evidence

- Controlled restart: the first planner-only request evaluated all 6,657 prompt
  tokens in 101.65 s and generated 230 tokens in 20.98 s; wall time was 122.66 s.
  The prior full 9,574-token production-context incident required 147.8 s for
  prompt ingestion before generation. The 195/210-second origin/application
  bounds remain unchanged.
- Cloudflare: a successful production planner took 64.47 s at the Worker versus
  64.07 s in llama.cpp (about 0.40 s relay/gateway overhead). Its answer took
  53.74 s at the Worker versus 53.22 s in llama.cpp (about 0.52 s overhead).
- Vercel/application/query: the same live request began its answer Worker call
  about 4 s after the planner Worker completed. Exact/lexical retrieval is only
  1.24 ms p95; the remaining interval includes response transit, value resolution,
  constrained query/audit work, and the next relay ingress.
- Queueing: while one valid production request held the single gateway slot, a
  second valid request returned HTTP 429 in 524 ms at the Worker and surfaced the
  bounded busy state in under 3.3 s in the browser. No second llama.cpp task was
  queued.
- VM 200: 12 vCPUs, 40 GiB RAM, no swap, about 17 GiB available while idle;
  model-service memory peaked near 22.6 GiB. Runtime: one 16,384-token slot,
  8 generation threads, 12 batch threads, batch 2,048, microbatch 512.
- LXC 105: one vCPU, 512 MiB RAM, about 467 MiB available, no swap use, healthy
  outbound-only `cloudflared` connector with no restart observed.

## Verification and release gate

The prompt, response schemas, runtime-contract checksum, model digest, catalog,
compiler policy, and frozen evaluation cases/rubrics do not change. Model-only
v5 receipts therefore remain hash-compatible: planner 1,122/1,122 and answer
114/114 across three repetitions. The application change still requires the
complete unchanged local gate and full one-user read-only production canary on
the deployed candidate before release acceptance or pilot expansion.

Durable private latency receipts are stored on Samson at
`/var/lib/accelerate-llm/evaluations/private-data-chat-latency-20260902-r1/`.
The repository probe `scripts/private-data-chat-samson-latency-probe.py` now
records wall, prompt-ingestion, generation, evaluated/cached token, and p50/p95
evidence without retaining model output.
