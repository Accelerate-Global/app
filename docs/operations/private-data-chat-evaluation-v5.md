# Private Qwen semantic RAG evaluation v5

Captured on 2026-09-01 against the pinned local Qwen 3.6 model on Samson VM
200. The model-only suite uses sanitized questions and synthetic answer rows. It
contains no production records, database credentials, Cloudflare credentials,
or database execution tool.

The frozen suite contains 436 reviewable cases: 374 typed semantic-planning
cases, 38 grounded-answer cases, and 24 bounded production end-to-end cases.
The final model gate executes every planner and answer case three times at
temperature zero. Production end-to-end results are added only after the
coordinated gateway/application release and Blake-only canary.

## Pre-release model result

| Gate | Result | Median | p95 |
| --- | ---: | ---: | ---: |
| Final targeted planner controls | 63/63 (100%) | 14.38 s | 23.09 s |
| Three clean semantic-plan repetitions | 1,122/1,122 (100%) | 20.17 s | 23.23 s |
| Three clean grounded-answer repetitions | 114/114 (100%) | 6.53 s | 12.02 s |
| Exact/lexical semantic retrieval holdout | 36/36 critical gates | 1.36 ms p95 | — |
| Governed ROP entry-search holdout | 12/12 critical gates | 127.75 ms p95 | — |

The planner result is complete across clarification, compatibility baseline,
controlled values, filter operators, grouping, injection resistance, metric
selection, multi-turn interpretation, named filters, null/zero behavior,
record projection, registered relationships, resource queries, safety
refusals, sorting/limits, and unsupported concepts. The answer result covers
completeness, empty results, grounded facts, null/zero behavior, and untrusted
result content.

The complete planner and answer runs produced no malformed outputs, retries,
timeouts, unknown catalog keys, executable SQL, or unsafe decisions. The exact
100-returned-of-103-matching evidence case passed all three answer repetitions.

## Retrieval selection

Production uses exact reviewed aliases plus private PostgreSQL full-text search,
typed dependency expansion, a six-item maximum, at most two reviewed examples,
and an 8 KiB serialized context cap. The lexical tier achieved 100% critical
Recall@1 and required-set coverage, 100% held-out Recall@6, and 0.7568 nDCG@6.

The local Qwen3 embedding candidate improved isolated nDCG to 0.7885 but caused
one of three concurrent generative probes to fail and increased generative p95
latency by 396.88%. The reranker failed both quality and latency gates. Neither
dense sidecar is deployed. The selection receipt is retained on Samson at
`/var/lib/accelerate-llm/evaluations/private-data-chat-rag-20260831-r2/final-selection.json`
(SHA-256
`513dbc4043d70da75ebd1694adb11b9c4cf07a72401793847e1f1e000610a429`).

## Remediation history

Every diagnostic miss was classified before another run:

- A genuine planner defect guessed that records could not have a missing people
  ID and clarified instead of emitting the approved `people_id = null` plan.
  Planner v23 now requires nullable ID/name queries and forbids guessing the
  current data contents.
- A genuine planner defect treated explicit nullable boolean alternatives
  `true OR false` as equivalent to no filter, which would incorrectly include
  null rows. Planner v24 preserves `in [true,false]` for nullable booleans.
- Three safe clarifications used semantically correct wording outside an overly
  literal text rubric: “not macro region,” “not an approved” forecast concept,
  and the approved dataset-bound ROP relationship/geography/classification-code
  alternative. The rubrics now accept those bounded equivalents while retaining
  the concept, limitation, approved alternative, and forbidden-claim checks.
- The remaining unsupported-concept rubrics were audited for the same wording
  brittleness before the clean run. No query authority, expected plan, safety
  decision, or forbidden behavior was weakened.

Failed and interrupted diagnostic receipts remain under the earlier r27-r32
directories on Samson. They are evidence for the remediation lineage and are
not counted in the final clean result.

## Pinned contract

- Suite: `private-data-chat-capabilities-v5.review-1`
- Complete-suite SHA-256: `558830f53f226c830f4fbaad7aa494edfcc5e1b349a9ef9996f8adb3a5e6afb7`
- Planner cases SHA-256: `864cdae4fde8414453007af82709f6ba98f719b1ef947b6c61c01cd23f371566`
- Answer cases SHA-256: `ff36e8524861b9c720d96e706da67a8c9b4b536abe659cd015ddf1edbbe5e798`
- End-to-end cases SHA-256: `264fee666c44aaa913d666aff984cff2801d1a7445824f4f81f2e76f9c9c9420`
- Review inventory SHA-256: `65705da52508a24f9c757a22b255e1af2e3414b57ab902daf6917d110dcbdeb3`
- Benchmark source SHA-256: `6ddbdced9256fdf902b8b984f195cfac5c071dd9b9ee0cd9f5407e7f627bfac9`
- Model artifact SHA-256: `671e47e0ec53c665d048b98c3ecbfd5236b5ca9c3e02ed19fc8f81f7b85140c7`
- llama.cpp revision: `c1d0e7a004015f23bc0233470b747b596f29b264`
- Query catalog: `primary-people-groups-v3.a57ff23d45ba`
- Query catalog SHA-256: `a57ff23d45bad3c6a120a4d6998752812f7491e35460c40762b5745181f332a4`
- Compiler policy: `query-policy-v4`
- Planner prompt: `people-groups-planner-v24`
- Planner prompt SHA-256: `f0490bf52c348377ebea6c039994fa6ead727b0957f548d26649e65c1b27eca3`
- Planner schema SHA-256: `c8ef2f4ec1a1b29067831bc7eca5a0e12bec0814760a9ba34d33fcd47c981d3b`
- Answer prompt: `grounded-answer-v6`
- Answer prompt SHA-256: `0d1ca9ee591623859b2b1eba83b71bc09d2d230807453744fd599c4829ba8f64`
- Answer schema SHA-256: `0ca0d0870ac2b4c6b1acd80182ce3c02f4d7cbade4b80a58978c1c2debe685bf`
- Runtime-contract SHA-256: `c1381aa55c14d407815ee5abc1b8c07320ad63a1788d51d77e40018212cbbd7a`
- Named-filter registry: `named-filters-v1.901b9eb6ad34`
- Retrieval policy: `semantic-retrieval-v1.exact-fts-coverage`
- Active semantic-context package: immutable v2, 52 cards, SHA-256
  `721481a1f2347c906a2ec58224ce80a313f206868a4bab1304fa097f9859f44c`

## Durable evidence

Final immutable bundle and receipts on Samson:

`/var/lib/accelerate-llm/evaluations/private-data-chat-v5-20260901-r33/`

- Targeted planner receipt: `bf9f385cd967af06ef7a5320ae69ec9212b81bda2f4fb88c2b015c80ddfc3175`
- First clean planner repetition: `5eab1df4dc95fcbf356268483a516ed65c0f725a10e1d6070d3394c8196d6ee1`
- Three clean planner repetitions: `f5fec77a4c416715f49239c72cfd78e3161d6f460606a43443d74b0798a45856`
- Three clean answer repetitions: `0f0624d499945067652095e611a6e9f39d69bdfcbd75e53a978eb1f5aca74aef`

## Release invariant

Qwen receives reviewed semantic context and emits a typed plan or a bounded
resource operation. It receives no database credential and never executes
model-written SQL. Application code validates the exact contract, resolves
controlled values, compiles parameterized SQL from trusted fragments, executes
through the bounded read-only role, and validates every narrated numeric claim
against the evidence ledger. Previous gateway hashes are accepted only for the
rolling transition and are removed after the strict production canary passes.
