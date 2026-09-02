# Private Qwen semantic RAG evaluation v5

Captured on 2026-09-01 through 2026-09-02 against the pinned local Qwen 3.6
model on Samson VM 200. The model-only suite uses sanitized questions and synthetic answer rows. It
contains no production records, database credentials, Cloudflare credentials,
or database execution tool.

The frozen suite contains 450 reviewable cases: 374 typed semantic-planning
cases, 38 grounded-answer cases, and 38 bounded production end-to-end cases.
The final model gate executes every planner and answer case three times at
temperature zero. The coordinated gateway/application release and Blake-only
production canary use the same pinned contract.

## Final evaluation result

| Gate | Result | Median | p95 |
| --- | ---: | ---: | ---: |
| Final targeted planner controls | 64/64 (100%) | 18.15 s | 22.78 s |
| Three clean semantic-plan repetitions | 1,122/1,122 (100%) | 20.35 s | 23.26 s |
| Three clean grounded-answer repetitions | 114/114 (100%) | 9.86 s | 19.61 s |
| Exact/lexical semantic retrieval holdout | 36/36 critical gates | 1.24 ms p95 | — |
| Governed ROP entry-search holdout | 12/12 critical gates | 86.61 ms p95 | — |
| Three production end-to-end repetitions | 114/114 (100%) | — | — |

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

The final end-to-end canary ran all 38 production cases three times through the
authenticated browser session, Vercel deployment, Cloudflare Access Worker/VPC
path, Samson gateway/Qwen, deterministic compiler, constrained Supabase role,
and evidence validator. All 114 passed, with 84 query decisions, 15 bounded
resource-query decisions, and 15 non-query clarifications/refusals. Coverage
validation found no missing or duplicate repetition/case key. The expanded
cases proved the exact 103 frontier, 104 reviewed-UUPG, 67 explicit dual-filter,
and 100-of-104 page outcomes; complete ROP browse/search/lookup/count/continue;
dataset-bound ROP3, natural-language geography, and null-preserving match-status
filters; the reviewed UUPG definition; and off-topic refusal. The first clean
canary result was deliberately executed after a controlled Qwen restart and
passed with an empty prompt cache. The canary-qualified deployment is
`dpl_4PMS9uyXwhskcFumr8LKYjxzvhPF`, sourced from commit
`7a19ea094d66ced8cde7d3730e70eaef80fac2f6`. The post-canary UI-copy release
was verified on deployment `dpl_CSZayZd3RtFsVaBn1i3xTA4TC1Qh`, sourced from
commit `02ba361c5d55f5241dbcecb604a5a3b5cb31d7e6` and aliased to
`https://data.accelerateglobal.org`.

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
- The first production canary correctly failed closed before planning when the
  request used the reviewed phrase “people IDs” with the country alias “U.S.”,
  because the hand-maintained domain-anchor vocabulary omitted that field
  phrase. Planner v25 and retrieval policy v1.1 now derive exact domain anchors
  from reviewed semantic labels and aliases. The synchronized catalog adds the
  plural alias, while the frozen sports hard negative continues to abstain with
  zero forbidden-card selections.
- Three safe clarifications used semantically correct wording outside an overly
  literal text rubric: “not macro region,” “not an approved” forecast concept,
  and the approved dataset-bound ROP relationship/geography/classification-code
  alternative. The rubrics now accept those bounded equivalents while retaining
  the concept, limitation, approved alternative, and forbidden-claim checks.
- Two additional safe clarifications used “filter or grouping criteria” and “I
  do not have access” for the required missing-scope and unavailable-prior-data
  limitations. Those equivalent phrases were added to the positive wording
  rubrics without changing decisions, authority, expected plans, or forbidden
  claims.
- A critical unregistered-join refusal correctly rejected physical joins and
  offered only the registered dataset-bound ROP3 relationship. The original
  case-folded forbidden substring `ON ` falsely matched the end of the ordinary
  word “classification.” The corrected rubric forbids concrete physical
  identifiers and predicate fragments instead. The 285 identical-contract
  outputs already produced were re-scored under the corrected rubric with a
  hash-bound compatibility-lineage receipt, and a fresh targeted model call
  passed before the clean sweep resumed.
- The production missing-population count exposed a legitimate transient-load
  timeout in the constrained function scan. The broker and both analytics roles
  now share a bounded 10-second statement ceiling instead of 5 seconds; the
  read-only transaction, 500 ms lock timeout, 5-second idle transaction limit,
  cost ceiling, row/result-size bounds, and one-query execution path are
  unchanged. No blind retry was added. The formerly failing case then passed a
  focused diagnostic and all three clean production repetitions.
- Production reference-resource health was selecting full normalized resource
  JSON and artifact manifests when it needed only active-version summaries.
  The catalog now selects only summary columns, preventing large catalog
  payloads from consuming the health-check budget without changing active
  resources or their content.
- Production continuation originally passed a JavaScript `Date` object into the
  PostgreSQL driver where the signed cursor contract required the exact ISO
  timestamp string. The continuation path now preserves the signed string and
  its second-page integration case passes in all three clean repetitions.
- The legacy current people-groups version lacked an immutable ROP binding even
  though the reviewed source version was valid. A production migration added
  the exact binding only when no producer publication exists; producer
  publication remains authoritative, and tests prove active-pointer drift
  cannot change an existing dataset relationship.
- Natural-language ROP geography initially treated `Sudan` as though it were a
  stored ROP geography code. The deterministic resolver now uses the reviewed
  country resource to resolve the name to a code present in the exact
  dataset-bound ROP version. The resulting query returns 25 of 234 without
  multiplying people-group rows in all three clean repetitions.
- Samson rebooted before the expanded canary and exposed that the original
  85-second origin deadline could not ingest the 9,574-token reviewed planner
  context from an empty prompt cache. A measured cold run needed 147.8 seconds
  for prompt ingestion and continued generating afterward. The final bounded
  deadlines are 195 seconds at the Samson origin and 210 seconds in the
  application, inside the verified 300-second Vercel function window. Origin
  504 is now normalized as a retryable timeout. A controlled post-release Qwen
  restart followed by the exact Sudan case passed end to end.
- The remaining unsupported-concept rubrics were audited for the same wording
  brittleness before the clean run. No query authority, expected plan, safety
  decision, or forbidden behavior was weakened.

Failed and interrupted diagnostic receipts remain under the earlier r27-r43
directories on Samson. They are evidence for the remediation lineage and are
not counted in the final clean result.

## Pinned contract

- Suite: `private-data-chat-capabilities-v5.review-1`
- Complete-suite SHA-256: `a551b24b7848ea0087253a93acd99ec61b9aa175d4f206b0fff2b572b340333e`
- Planner cases SHA-256: `fb443628c2dc5e867293c06c087c45f7a48e9654264e3d9f66438cde5af77bea`
- Answer cases SHA-256: `05170a0dc4667f545b2076b06b5cfb488370a433c97b96f210ce6a5cadc844df`
- End-to-end cases SHA-256: `9885d4d5eaab8b2c4f366188b90f30fced8cb95196e650c64b7a0aca0348d5ca`
- Review inventory SHA-256: `3e026727187fae6dea8fabdef137cf3140fbc5b76f33dcf71695db0b34a04fbf`
- Benchmark source SHA-256: `6ddbdced9256fdf902b8b984f195cfac5c071dd9b9ee0cd9f5407e7f627bfac9`
- Model artifact SHA-256: `671e47e0ec53c665d048b98c3ecbfd5236b5ca9c3e02ed19fc8f81f7b85140c7`
- llama.cpp revision: `c1d0e7a004015f23bc0233470b747b596f29b264`
- Query catalog: `primary-people-groups-v3.1fb6c15a7250`
- Query catalog SHA-256: `1fb6c15a7250f241cfaf89b8d7e442584a3cfcd1ec6970f88229adb4b5d916a6`
- Compiler policy: `query-policy-v4`
- Planner prompt: `people-groups-planner-v25`
- Planner prompt SHA-256: `3b7a99290db275fc54479f751f50db834b5607af1f80e9b5d59bfa5d36fa885b`
- Planner schema SHA-256: `65f62de2672c4556028c6ca7c45c19a2f536b9fbfb3cc9e99e26d21b435889e6`
- Answer prompt: `grounded-answer-v6`
- Answer prompt SHA-256: `0d1ca9ee591623859b2b1eba83b71bc09d2d230807453744fd599c4829ba8f64`
- Answer schema SHA-256: `0ca0d0870ac2b4c6b1acd80182ce3c02f4d7cbade4b80a58978c1c2debe685bf`
- Runtime-contract SHA-256: `a7f3c4e59c6b7deda4101d59e5761fdbc86d2a1edfb50671f6147c3b60f7bd77`
- Named-filter registry: `named-filters-v1.901b9eb6ad34`
- Retrieval policy: `semantic-retrieval-v1.1.reviewed-exact-anchor-fts-coverage`
- Active semantic-context package: immutable version 4
  (`7f183abe-dfa7-4511-b821-7abca3bc4a06`), 52 cards, content SHA-256
  `75c794448faa97e58310f931da67a7a0cbcf21a3e64f1c000b211e3f6193817f`

## Durable evidence

Final immutable bundle and receipts on Samson:

`/var/lib/accelerate-llm/evaluations/private-data-chat-v5-20260901-r44/`

- Inherited targeted planner receipt: `76947ad11bf455e51f3493b7715d1d2b7bf0fb6d04e0ba5af9f089dbfb1e0cbc`
- Inherited three clean planner repetitions: `6fb0541b1a15dbb6f43542361da3bca4171f0434e426da0088f50c8619d0c319`
- Inherited three clean answer repetitions: `461f87d35a470651838988e7066c29dd0f1817df8709b1fe18b686339a813e68`
- Compatible 285-output rubric-rescore lineage: `e2e7cd9496812e2eb075ff2d776f8230cacf4f8062ef107a0d1de7db5ce031de`
- Fresh critical join-refusal diagnostic: `1e331a79f00206a2bd20444a8825e1c785e278d35415302faeb05c6cb37e664a`
- r37-to-r40 unchanged-model-contract lineage: `9de4ced30f84f5d358107a4831667c8bcdfa4aa86365d097e58aebbfe7d40b0e`
- Inherited 72-result production canary: `5e02d39b4c1315f072037a93a484e756f064b9314914b47380b802ec86cd1673`
- Final 114-result production canary: `aebf94c32a06571e402c4131a6fcd4c010698000c97ffafd4d6eda4f0c29d366`
- Expanded-canary progress receipt: `68896ab04a10b4f6eefd2a84562773d429ac65491bb0071db68cad62f10437d2`
- Final suite manifest: `9a818cfbec61f7b18535b1be28529fe67887b5fab6c38a23c8816530b27d8fbb`
- Immutable archive manifest: `b42b194559b23ed57dcef691f52e32b4c5c431097f3295e082db3723489b15bf`

After the canary, the Samson gateway removed every rolling-previous prompt and
runtime-contract hash. Its final root-owned environment SHA-256 is
`4e8cdea5fde1f5e48f82708ec14261216295f66034d9193aeb8e711d1b13bb07`;
the installed gateway source SHA-256 is
`100f9b969d14545f9b472e7f11c830b9182070cf9e6cc2d3869177f2bf3f14b5`.
Post-rotation live checks passed strict TLS health, current-contract signing,
replay rejection, expired-signature rejection, one-slot busy behavior, and the
public Vercel/Cloudflare/Worker/VPC/Samson query path.

## Release invariant

Qwen receives reviewed semantic context and emits a typed plan or a bounded
resource operation. It receives no database credential and never executes
model-written SQL. Application code validates the exact contract, resolves
controlled values, compiles parameterized SQL from trusted fragments, executes
through the bounded read-only role, and validates every narrated numeric claim
against the evidence ledger. Previous gateway hashes are accepted only for the
rolling transition; the final production gateway now accepts only the pinned
current hashes above.
