# Private Qwen semantic-context evaluation v1 — proposed review inventory

This is a static, sanitized review artifact. Generating it does not call Qwen,
Samson, Supabase Production, Cloudflare, or Vercel. The executable source is
`src/lib/private-data-chat/semantic-evaluation-corpus.ts`.

## Frozen split

- 36 questions across 18 intent/plan-skeleton groups.
- Train: 12 questions. Only explicitly marked train cases may seed reviewed
  semantic-plan demonstrations.
- Dev: 12 questions for tuning deterministic retrieval and prompt policy.
- Holdout: 12 questions sealed from demonstration selection and tuning.
- Every intent group and plan skeleton belongs to exactly one partition.

## Required coverage

- Exact UUPG and global-engagement definitions, current-view inheritance, and
  one-criterion UUPG options.
- Matching-versus-returned completeness, including deterministic
  `103 match; showing 100` wording.
- Exact ROP lookup, complete browsing/continuation, hierarchy filtering,
  immutable dataset-version binding, geography `EXISTS`, and dedicated
  geography grain.
- Ambiguity clarification, missing ranking metric/limit, off-topic refusal,
  lifecycle mutation refusal, physical/unregistered-join refusal, retrieved
  instruction injection, and invalid signed state.

## Human labels

Every case declares required, relevant, and forbidden semantic-card keys plus
its expected typed decision, mode, named-filter/resource/relationship key, and
stable reason or deterministic phrase where applicable. Critical cases are
release blocking. Automated RAG judges may diagnose results but cannot change
these labels or become the sole gate.

## Approved promotion gates

- Critical exact/alias/resolver retrieval: 100% Recall@1.
- Release-blocking multi-concept cases: 100% required-set coverage.
- Held-out paraphrases: at least 95% Recall@6.
- Zero excluded, wrong-audience, stale, or critical hard-negative cards.
- Denser retrieval must improve held-out Recall@6 or nDCG@6 by three absolute
  points or fix three predeclared material misses without a critical regression.
- Context is capped at six items, two demonstrations, and 8 KiB.
- Latency and Samson resource gates are those frozen in the OpenSpec design.
