# Private Qwen capability evaluation v4

Captured on 2026-08-30 through 2026-08-31 against the pinned local Qwen 3.6
model on Samson VM 200 and the Blake administrator production canary at
`data.accelerateglobal.org`.

The final suite contains 306 reviewable cases: 246 semantic-planning cases, 36
synthetic grounded-answer cases, and 24 read-only end-to-end conversations.
Planner and answer fixtures contain no production records. The end-to-end
receipt contains only structural outcomes, catalog revisions, bounded row
counts, query identifiers, timings, and response hashes; it contains no result
rows or response text.

## Result

| Gate | Result | Median | p95 |
| --- | ---: | ---: | ---: |
| Final diagnostic semantic plans | 246/246 (100%) | 14.81 s | 17.47 s |
| Final diagnostic grounded answers | 36/36 (100%) | 7.58 s | 14.50 s |
| Three clean semantic-plan repetitions | 738/738 (100%) | 14.79 s | 17.59 s |
| Three clean grounded-answer repetitions | 108/108 (100%) | 6.34 s | 17.17 s |
| Three production end-to-end repetitions | 72/72 (100%) | 28.85 s | 73.73 s |

Each model-only case ran at temperature zero against the same prompt, schema,
catalog, model artifact, and llama.cpp revision. Each production case started
with a cleared conversation and used Blake's administrator account as the
bounded production canary. Every production repetition passed 24/24.

## Coverage

The planner corpus covers the complete approved semantic surface: all four
metrics, all record and grouping fields, every permitted filter operator,
controlled country names/aliases/codes, null-versus-zero behavior, explicit
sorting and bounds, multi-turn follow-ups, unsupported concepts, read-only
refusals, and instruction-, SQL-, Unicode-, and punctuation-shaped inert
values.

The synthetic answer corpus covers scalar and grouped metrics, units, ordered
records, large values, nulls, zeros, false values, empty results, and untrusted
result text. The production corpus exercises the authenticated browser, Vercel
application, Cloudflare Access and Worker path, Samson gateway, local Qwen,
typed semantic plan, deterministic compiler, parameterized read-only broker,
provenance, and grounded narration.

## Remediation history

The first broad diagnostic intentionally exposed both model weaknesses and
test-contract weaknesses. Every miss was classified before rerunning:

- Planner instructions were strengthened around minimal projections, implicit
  sorting, null filters, exact inert values, unsupported concepts, and bounded
  follow-ups.
- Answer instructions were strengthened around units, row order, zero causes,
  and boolean/null wording.
- Text rubrics were changed from literal phrasing checks to bounded semantic
  alternatives where multiple safe answers are equivalent.
- Ambiguous prompts and incorrect expectations were corrected instead of
  training the model toward an arbitrary golden answer. In particular,
  `Congo` is the exact approved display name in the active country catalog;
  `Democratic Republic of the Congo` is a distinct exact display name.
- Closed `<details>` content in the browser harness is read with `textContent`
  for structural provenance scoring while assistant narration remains
  text-only. Harness diagnostics are excluded from the official 72-case
  receipt.

The final r8 end-to-end-only corrections and r9 review-format normalization did
not change the planner cases, answer cases, planner prompt, answer prompt,
schemas, model, or runtime from the clean r6 model-only run. The r6 model
receipts therefore remain the exact evidence for those unchanged contract
hashes; r9 is the final complete suite and production receipt.

## Pinned contract

- Suite: `private-data-chat-capabilities-v4.review-1`
- Final complete-suite SHA-256: `326f20432ed082f33d8f74fafeac6005f361fac822308fb7e6538fad9c24db7d`
- Planner cases SHA-256: `301f36cefb183578ce9762b98a8b3d0a7b471141f49d17ed019588ee1faf513e`
- Answer cases SHA-256: `9c442e78a01be9d266360325be2189e94e5216a4f579b1f682e591fa00e06d6e`
- End-to-end cases SHA-256: `c750495ee0243aa4c8470cebfa188573787d2b5d994fa063dfaa220a623ecce7`
- Review inventory SHA-256: `d194dd59a4c14f650a0c3eb58d075b3e82f279352bc4b60a756e36b739631f54`
- Benchmark source SHA-256: `6e010c471161de021468d34b6c87bcae854ef96f25f1388ea5ab0ffe08ab5096`
- Model artifact SHA-256: `671e47e0ec53c665d048b98c3ecbfd5236b5ca9c3e02ed19fc8f81f7b85140c7`
- llama.cpp revision: `c1d0e7a004015f23bc0233470b747b596f29b264`
- Catalog revision: `primary-people-groups-v2.ac1c90c20f2d`
- Catalog SHA-256: `ac1c90c20f2dce52e95307a857ba66273e3a0d6699402326b6a40fce74ac59a6`
- Compiler policy: `query-policy-v2`
- Compiler source SHA-256: `046df4f0f39efa47ba2fafc4dbd0b5ce3a175bfbb3f17523d2f054bbe096d414`
- Planner prompt: `people-groups-planner-v4`
- Planner prompt SHA-256: `b98ac8db39205e47b18deb643fd780ede161b1046c74b2e1c5d7fbb61afdb9ab`
- Planner schema SHA-256: `1ee23c822b4e0f6bf2bf36791f9090059086697f87d0b00354ab50f10d6d4ba4`
- Answer prompt: `grounded-answer-v3`
- Answer prompt SHA-256: `d1c6c9cbe559086d9e5302616fba8ac1ef0c8eb56bf4cd91922bf6e9a3f041b8`
- Answer schema SHA-256: `0ca0d0870ac2b4c6b1acd80182ce3c02f4d7cbade4b80a58978c1c2debe685bf`
- Canary deployment: `dpl_29u2CdkEm7LFkh67SiE4vMW6J1UB`

## Durable evidence

Final model-only r6 bundle and receipts on Samson:

`/var/lib/accelerate-llm/evaluations/private-data-chat-v4-20260831-r6/`

- Diagnostic plan receipt: `a1b5fd6994c65f6ee8dfbaf5010c9f63968b9941978cf224a66379d6bbf8e756`
- Diagnostic answer receipt: `9bda41138e720f5f30e423426eecbd63f30baec1ba6a2ed1ec43e94768e254d6`
- Three-repetition plan receipt: `07487ee8e4e9171c3a81b552328363e2be86660928a8a84d698ca314544a1155`
- Three-repetition answer receipt: `5c1d85c07fef717b5b6f4317f88365ad4dd97ea2061d6d8bdad1205e0edbecbf`

Final complete r9 bundle and sanitized production receipt on Samson:

`/var/lib/accelerate-llm/evaluations/private-data-chat-v4-20260831-r9/`

- Sanitized production receipt: `841880097d522fb6fe4931e29a8b9c0cc50defad91d0ff050fc785486b5c82b4`

## Release invariant

Qwen receives the versioned semantic catalog and emits a typed semantic plan.
It never receives database credentials and never executes model-written SQL.
Application code validates the plan, resolves controlled values, compiles a
parameterized query deterministically, and executes through the bounded
read-only analytics role. The gateway accepts the previous prompt hashes only
for the rolling application transition; remove them after production health
and release verification pass.
