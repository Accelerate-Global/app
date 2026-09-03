# Private Data Chat deterministic geography evaluation v6

Captured on 2026-09-03 for the app-owned country/filter-region scalar-query
extension. The v6 suite contains 455 reviewable cases: the unchanged 374 Qwen
planner cases, unchanged 38 Qwen answer cases, and 43 bounded end-to-end cases.
The five new cases cover India population, South Asia population, India
people-group count, mixed country/region ambiguity, and unknown geography. They
contain no production result values and declare zero model calls.

## Compatibility decision

The application change does not alter the Qwen planner prompt, answer prompt,
response schemas, semantic query catalog, compiler policy, runtime contract,
model artifact, or llama.cpp revision. Normalizing only the suite wrapper from
v6 back to v5 reproduces the fully evaluated v5 planner-case hash
`fb443628c2dc5e867293c06c087c45f7a48e9654264e3d9f66438cde5af77bea`
and answer-case hash
`05170a0dc4667f545b2076b06b5cfb488370a433c97b96f210ce6a5cadc844df`
exactly. The prior passing 1,122/1,122 planner and 114/114 answer repetitions are
therefore inherited rather than rerunning identical inference for several
hours.

The live Samson verification matched the same pinned contract:

- Planner prompt SHA-256: `3b7a99290db275fc54479f751f50db834b5607af1f80e9b5d59bfa5d36fa885b`
- Answer prompt SHA-256: `0d1ca9ee591623859b2b1eba83b71bc09d2d230807453744fd599c4829ba8f64`
- Runtime-contract SHA-256: `a7f3c4e59c6b7deda4101d59e5761fdbc86d2a1edfb50671f6147c3b60f7bd77`
- Model artifact SHA-256: `671e47e0ec53c665d048b98c3ecbfd5236b5ca9c3e02ed19fc8f81f7b85140c7`
- llama.cpp revision: `c1d0e7a004015f23bc0233470b747b596f29b264`

Model, origin-gateway, and Cloudflare-tunnel services were active. Qwen health
was `ok`; VM 200 had approximately 20.7 GiB available memory and no swap.
No Samson configuration changed.

## Deterministic result

The focused filter-region source, geography resolver, retrieval, and
orchestrator suite passed 28/28 cases in each of three clean repetitions. The
broader changed-area suite passed 47/47. The terminal repository gate passed
OpenSpec validation, type checking, test-delta enforcement, 2,413 application
tests, lint, and a production Next.js build.

The exported v6 bundle is
`private-data-chat-capabilities-v6.review-1`, with complete-suite SHA-256
`8dc89e22adaa5c3cf6e7b381c291d02ddbf308f4ba5779caac75ed8590196490`.
The new behavior keeps geography out of model authority: application code owns
the typed metric and exact country set, then uses the existing controlled-value
resolver, parameterized compiler, read-only broker, and deterministic evidence
renderer.

Production acceptance remains the Blake-only read-only canary defined by the
archived change. Release Health and the operator's production receipt are the
authoritative post-merge evidence; no private result value is committed here.
