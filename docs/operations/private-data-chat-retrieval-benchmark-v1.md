# Private Qwen semantic retrieval benchmark v1

Generated deterministically from the frozen human-labeled semantic-evaluation-v1 corpus. No Qwen inference, production prompt, production row, credential, or automated LLM judge is used in this gate.

## Selected runtime tier

**Exact reviewed aliases + private PostgreSQL full-text retrieval.** This is the smallest tier that passes every critical release gate. Dense embedding and reranking remain undeployed unless the Samson bakeoff demonstrates the predeclared material gain without resource or generative-queue regression.

## Results

| Metric | Result |
| --- | ---: |
| Cases | 36 |
| Exact/resolver critical Recall@1 | 100.00% |
| Critical required-set coverage | 100.00% |
| Held-out Recall@6 | 100.00% |
| Held-out nDCG@6 | 0.7568 |
| MRR | 0.6898 |
| Forbidden selections | 0 |
| Off-topic clarification/abstention | 100.00% |
| Maximum serialized context | 5201 bytes |
| In-process lexical p95 | 1.2390 ms |
| Repeatable across three runs | Yes |

## ROP entry-search holdout

| Metric | Result |
| --- | ---: |
| Cases | 12 |
| Exact code/name Recall@1 | 100.00% |
| Recall@6 | 100.00% |
| Hard-negative accuracy | 100.00% |
| In-process p95 after private-index construction | 86.6147 ms |
| Repeatable across three runs | Yes |

## Samson Qwen3 embedding/reranker bakeoff

The frozen 36-case corpus was also run on Samson against pinned Q8 candidates. The final sanitized selection receipt is /var/lib/accelerate-llm/evaluations/private-data-chat-rag-20260831-r2/final-selection.json (SHA-256 513dbc4043d70da75ebd1694adb11b9c4cf07a72401793847e1f1e000610a429).

| Tier | Exact critical Recall@1 | Critical set coverage | Held-out Recall@6 | Held-out nDCG@6 | p95 | Production selection |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Exact + PostgreSQL lexical | 100.00% | 100.00% | 100.00% | 0.7568 | 1.24 ms in-process | **Selected** |
| Qwen3 embedding + exact RRF | 100.00% | 100.00% | 100.00% | 0.7885 | 166.08 ms query embedding | Rejected on concurrency |
| Qwen3 reranker | 83.33% | 90.63% | 81.25% | 0.5711 | 24,526.24 ms | Rejected on quality and latency |

The hybrid tier cleared the isolated three-point nDCG material-gain rule, and Samson still had 28.41% memory available with no swap. It nevertheless failed the governing capacity gate: a concurrent representative Qwen planner probe completed only 2/3 calls and reached 96,771.06 ms p95 versus a clean 19,475.76 ms baseline—a 396.88% degradation. The approved gate permits no new failures and at most 5% degradation. Both temporary loopback candidate services were stopped; their pinned artifacts and receipts remain private for reproducibility, not production serving.

## Gates

- PASS: exactCriticalRecallAt1
- PASS: criticalRequiredSetCoverage
- PASS: holdoutRecallAt6
- PASS: noForbiddenSelection
- PASS: clarificationAccuracy
- PASS: contextBudget
- PASS: lexicalLatency
- PASS: repeatable

## Release-blocking failures

None.

## Method

- Relevance sets, hard negatives, partitions, and demonstration eligibility were frozen before tuning.
- Exact key/alias precedence runs before lexical ranking.
- Dataset, audience, sensitivity, and query-authority filters run before ranking.
- Typed dependencies are expanded and required evidence is pinned.
- Context is capped at six items, two train-only demonstrations, and 8 KiB.
- Deterministic plan, compiler, SQL/result, evidence, and security assertions remain separate authoritative gates.
- ROP entry retrieval covers exact hierarchy codes/names plus reviewed descriptions, place, language, geography, status, join issue, and hard-negative behavior; version and permission isolation remain database/application security gates.
- Qwen3-Embedding-0.6B and Qwen3-Reranker-0.6B were tested, not assumed. Production remains on the smaller lexical tier because the complete quality-and-capacity decision, not isolated ranking gain, is authoritative.
