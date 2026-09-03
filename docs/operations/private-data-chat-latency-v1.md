# Private Qwen data-chat latency qualification v1

Captured on 2026-09-02/03 against the production Qwen 3.6 runtime on Samson VM
200, tunnel LXC 105, the Access-protected Cloudflare Worker/VPC path, and the
Vercel production application. Measurements retain timings, counts, paths,
statuses, and hashes only. They do not retain prompts, conversation text, model
output, result rows, credentials, authorization headers, cookies, or raw provider
errors.

## Decision and production state

Validated analytical query results now use the deterministic evidence renderer
instead of a second grounded-answer Qwen call. Planning remains a
schema-constrained Qwen inference. Semantic retrieval, value resolution, the
compiler, read-only broker, completeness checks, signed turn state, provenance,
off-topic controls, and frozen rubrics remain enforced.

The model receives the established validated retrieval metadata and selected
reviewed items, but not the duplicate `serialized` copy of those same items.
Exact scalar country/filter-region questions retain the zero-model geography
path. Richer analytical prose falls back to reviewed planning unless contained
geography aliases cover the whole candidate; this prevents words such as `to`,
`and`, and `Global Engagement Anywhere` from being mistaken for additional
geographies.

The accepted production state is merge `792fd8147817a82fa129a7ff6249e0596be2f4ab`
on deployment `dpl_EHSrBPir8nSaVWBTqPg5hnGdsdZQ`.

## Before evidence

The sanitized journal correlation covered 146 successful production analytical
plan-to-answer pairs observed since 2026-09-01. It paired each gateway completion
with the nearest llama.cpp task completion and modeled end-to-end time as planner
model work plus deterministic/provider handoff plus answer model work. It excluded
initial browser/Vercel ingress and final SSE delivery, so it was slightly lower
than user-visible wall time.

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
shape: 43.93 s planner prompt ingestion, 18.37 s planner generation, roughly 5 s
of application/query handoff, 49.70 s answer prompt ingestion, and 4.21 s answer
generation. User-visible completion was about two minutes.

The active planner system prompt is 30,509 characters and its strict response
schema is 6,429 serialized bytes. Frozen exact/lexical retrieval itself measured
1.24 ms p95 in process and was never a material contributor.

## Rollout sequence and canary findings

1. PR #53 removed the narrator inference. A repeated identical production query
   reached 25.385 s p50 and 27.023 s p95 over five warm samples, with first-SSE
   p50/p95 of 0.556/0.878 s. One cache-displaced request took 75.778 s.
2. A varied 15-case production slice exposed the remaining prompt cost. Ten
   model-planned cases measured 71.167 s p50 and 78.433 s p95; five zero-model
   geography cases measured 0.996 s p50 and 1.549 s p95. The planner payload
   duplicated selected semantic items in both `items` and `serialized`, causing
   2,643–3,085 evaluated prompt tokens and 45–53 s prompt ingestion.
3. PR #55 removed the duplicate and all retrieval metadata. Prompt evaluation
   fell to 1,138–1,198 tokens and 19–20 s, but its guarded canary raised a
   supported-query quality risk. Production was immediately rolled back to PR
   #53. One multi-turn signal was later traced to an invalid synthetic transcript
   without signed state; two single-turn clarifications remained sufficient to
   require a conservative forward fix.
4. PR #56 restored retrieval status, snapshot/policy identity, views, exact keys,
   byte count, and selected items while continuing to omit only `serialized`.
   Its canary proved the single-turn clarifications occurred before Qwen in the
   pre-existing PR #54 geography fast path, not in model context compaction.
5. PR #57 fixed that resolver collision. Production stayed on PR #53 throughout
   diagnosis and moved forward only after local release gates, fresh CI, exact-SHA
   Release Health, and the fail-fast Blake-only canary passed.

## Final browser and API evidence

The complete production canary exercised 43 reviewed cases across three
repetitions. The table uses successful single-turn calls; multi-turn totals are
reported separately. First-SSE timing includes browser-to-Vercel ingress and
authenticated application setup. The planner interval is measured from the
`interpreting` event to `validating`; query/audit is `querying` to `explaining`.

| Phase | Samples | p50 | p95 |
| --- | ---: | ---: | ---: |
| Request to first SSE/status event | 119 | 0.616 s | 1.217 s |
| Request through retrieval to `interpreting` | 110 | 0.625 s | 1.229 s |
| Qwen plan to `validating` for dataset queries | 86 | 46.086 s | 56.035 s |
| Resolution, read-only query, audit to `explaining` | 86 | 0.923 s | 5.918 s |
| Deterministic render/final SSE after `explaining` | 86 | 0.0003 s | 0.0059 s |
| Successful single-turn dataset query end to end | 87 | 47.9 s | 58.2 s |
| Zero-model geography path end to end | 15 | 0.987 s | 1.525 s |

The final varied single-query result reduces the original modeled end-to-end
p50 by about 49.8% and p95 by about 60.1%. Against PR #53's deployed varied slice,
the metadata-preserving compaction removes another 32.7% at p50 and 25.8% at p95.
The 25-second repeated-query result remains a useful best case, not the expected
latency for varied questions.

Real multi-turn totals were stable across three repetitions:

| Flow | p50 | p95 |
| --- | ---: | ---: |
| Clarification then top-five ranking | 71.536 s | 73.655 s |
| Signed India-to-Nepal query follow-up | 92.694 s | 93.033 s |
| ROP first-page fetch then signed continuation | 40.647 s | 41.080 s |

## Final Samson evidence

The production qualification window contained 118 complete llama.cpp tasks,
including real multi-turn precursor calls and the exact retry described below.

| Model phase | p50 | p95 |
| --- | ---: | ---: |
| Evaluated prompt tokens | 1,433 | 1,871 |
| Prompt ingestion | 24.061 s | 30.763 s |
| Completion tokens | 216 | 301 |
| Generation | 20.595 s | 28.728 s |
| Total model work | 45.005 s | 55.017 s |

Compared with the original 45.30/52.06-second prompt-ingestion p50/p95, the
accepted envelope reduces prompt ingestion by about 46.9%/40.9% without changing
the model, system prompt, schema, retrieval selection, compiler, database, or
network runtime.

## Quality, failure, and capacity evidence

- The fail-fast production subset passed 7/7: both exact Sudan regressions, a
  signed India-to-Nepal follow-up, India and South Asia geography queries,
  unknown-geography clarification, and off-topic refusal.
- All 129 case/repetition combinations produced a successful validated outcome:
  93 dataset queries, 15 ROP resource operations, and 21 expected clarifications
  or refusals. Multi-turn ranking used a real clarification response; country
  switching used the returned signed turn token; ROP continuation used the
  returned signed continuation token.
- One third-pass frontier-population attempt emitted `stream_internal` after
  Samson completed normally. It had passed twice earlier, its exact retry passed
  in 27.563 s, the remaining 26 cases passed, and two additional exact stability
  replays passed in 52.691 s and 24.101 s. Vercel showed no error-level events and
  no 5xx responses in the 500 most recent `/api/chat` log records. This transient
  is retained as operational evidence rather than counted as a model or rubric
  regression.
- While one valid request occupied Samson, a second valid request returned the
  existing bounded `busy` state in 2.289 s; the first request completed normally
  in 44.975 s. No second llama.cpp task queued.
- Cloudflare relay/gateway overhead previously measured about 0.40 s on a planner
  call and 0.52 s on an answer call. That layer was unchanged.
- VM 200 remains 12 vCPUs, 40 GiB RAM, no swap, one 16,384-token llama.cpp slot,
  8 generation threads, 12 batch threads, batch 2,048, and microbatch 512. LXC
  105 remains a one-vCPU, 512-MiB outbound-only tunnel host.
- A controlled cold planner restart remains materially slower: the original
  planner-only cold probe evaluated 6,657 tokens in 101.65 s and generated 230
  tokens in 20.98 s. The existing 195/210-second origin/application bounds remain
  necessary; this release optimizes normal warm service, not cold model loading.

## Privacy and acceptance boundary

The prompt, response schemas, runtime-contract checksum, model digest, catalog,
compiler policy, read-only broker, and frozen evaluation rubrics were not changed.
Only Blake's exact administrator canary exercised production data. The runner
retained decisions, contract checks, phase timings, counts, and failure classes;
it did not persist questions, answers, rows, signed tokens, cookies, or headers.

Durable private model-evaluation receipts remain on Samson at
`/var/lib/accelerate-llm/evaluations/private-data-chat-latency-20260902-r1/`.
The repository probe `scripts/private-data-chat-samson-latency-probe.py` records
wall, prompt-ingestion, generation, evaluated/cached-token, and p50/p95 evidence
without retaining model output.
