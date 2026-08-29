# Private Qwen semantic evaluation v3

Captured on 2026-08-29 against the pinned local Qwen 3.6 model on Samson VM
200. The suite used sanitized questions and fully synthetic answer rows. It
contained no production records, database credentials, Cloudflare credentials,
or database execution tool.

## Result

| Gate | Result | Median | p95 |
| --- | ---: | ---: | ---: |
| Typed semantic plans | 69/69 (100%) | 14.33 s | 17.97 s |
| Grounded answers | 15/15 (100%) | 4.83 s | 8.25 s |

Each case ran three times at temperature zero with seed `20260829`. There were
no malformed or inconsistent outputs. The planning suite covered 23 cases:
aggregates, record selection, aliases, country codes and multi-value filters,
nullable fields, zero-versus-null behavior, bounded empty results, unsupported
grouping/time/join concepts, ambiguous rankings, multi-turn clarification,
mutation/export/prompt refusals, SQL-shaped literals, and instruction-shaped
literals. The answer suite covered exact counts, ranked totals and units, empty
results, null-not-zero semantics, and an instruction embedded in result data.

## Pinned contract

- Model SHA-256: `671e47e0ec53c665d048b98c3ecbfd5236b5ca9c3e02ed19fc8f81f7b85140c7`
- llama.cpp revision: `c1d0e7a004015f23bc0233470b747b596f29b264`
- Catalog revision: `primary-people-groups-v2.ac1c90c20f2d`
- Catalog SHA-256: `ac1c90c20f2dce52e95307a857ba66273e3a0d6699402326b6a40fce74ac59a6`
- Compiler policy: `query-policy-v2`
- Planner prompt: `people-groups-planner-v3`
- Planner prompt SHA-256: `de1f04cb9761bd81645a066325270f25d03e6465676e73a2d4308aad6e688053`
- Canonical plan-schema SHA-256: `1ee23c822b4e0f6bf2bf36791f9090059086697f87d0b00354ab50f10d6d4ba4`
- Plan cases SHA-256: `a78a98a2e832c458928bc297eaa58d1db8f6f90a692d9d6067db666bde48367c`
- Answer prompt: `grounded-answer-v2`
- Answer prompt SHA-256: `4ba84888d5789ce18f9747f4fa2bbf50aa34128c69347ae93489abea3d94f5ed`
- Canonical answer-schema SHA-256: `0ca0d0870ac2b4c6b1acd80182ce3c02f4d7cbade4b80a58978c1c2debe685bf`
- Answer cases SHA-256: `e308a436e33d3e3f56d8380222fa4d9f302526ecac6af9e9c9168fdd2a68feb6`

## Durable evidence

The exact prompts, schemas, cases, runner, raw structured outputs, timing, model
pin, and receipt hashes are retained on Samson at:

`/var/lib/accelerate-llm/evaluations/private-data-chat-v3-20260829/`

Raw receipt SHA-256 values:

- Plan receipt: `ea5d6e1a263652e6cc17347ebf14dbe72378a1a127f4e646fff3d3a1f467ffce`
- Answer receipt: `dc7f7ee7b8165b33382f136fa928bb84c0ad193eabd2483a549c785c2fdbf8fc`

The deployed gateway keeps the prior and candidate prompt hashes only for the
rolling Vercel transition. After production health passes, the previous hashes
must be removed and semantic context made mandatory again.
