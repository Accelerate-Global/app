# Qwen Semantic RAG Research Review

Research date: August 31, 2026

## Scope

This review asks which current, respected RAG methods should sit between the local Qwen 3.6 model and Accelerate Global’s structured data and semantic resources. It favors peer-reviewed papers, official model/repository documentation, official PostgreSQL/Supabase guidance, and recognized security guidance. General benchmark results are treated as evidence to test a method, not proof that it will work on Accelerate Global terminology.

The safety invariant remains unchanged: Qwen receives no database credential or arbitrary SQL capability. It emits a typed semantic plan; deterministic application code validates the plan, resolves approved values, compiles parameterized SQL, and executes through the bounded read-only analytics role.

## Conclusion

The recommended pattern is **schema-aware semantic RAG with a benchmark-selected retrieval tier**:

1. Always resolve exact concept keys, aliases, signed current-view filters, and approved value domains deterministically.
2. Search contextual, reviewed semantic cards with PostgreSQL full-text search.
3. Expand only typed semantic dependencies required to cover the question.
4. If a held-out domain benchmark proves a material gain, add local Qwen3-Embedding-0.6B vectors, exact pgvector search, and reciprocal-rank fusion.
5. Add Qwen3-Reranker-0.6B only if it proves a further material gain within the Samson resource envelope.
6. Retrieve no more than two reviewed question-to-typed-plan examples; never retrieve SQL examples.
7. Give Qwen a minimal coverage set, not the whole registry and not a flat top-k list.
8. Keep result counts and user-visible numeric facts deterministic.

This is RAG, but it is not ordinary document-chat RAG. The corpus is a reviewed semantic layer over structured data; retrieval helps Qwen understand terms, scope, filters, value domains, relationships, and examples, while the typed plan/compiler boundary remains the only executable authority.

## Primary-source findings and plan implications

### Hybrid retrieval, controlled rewriting, and reranking

**Verified evidence:** A 2026 SemEval multi-turn RAG system combined sparse and dense retrieval, controlled query rewriting, and cross-encoder reranking. It ranked third of 38 on the official retrieval task and exceeded the cited baseline. [ACL Anthology](https://aclanthology.org/2026.semeval-1.32/)

**Conclusion for this project:** Multi-turn retrieval should use the original utterance plus controlled expansions from signed current-view and prior-turn concept state. It should not add a second generative rewrite call. Hybrid retrieval and reranking deserve a bakeoff, not automatic adoption.

### Schema linking is a first-class retrieval problem

**Verified evidence:** EACL 2026 work separates schema linking from SQL generation and combines table-first/column-first retrieval, question decomposition, and keyword/keyphrase extraction. On BIRD and Spider it improved schema recall and reduced false positives; the paper reports that compact retrieved schema outperformed full-schema baselines and closed half the reported gap to oracle schema. [ACL Anthology](https://aclanthology.org/2026.findings-eacl.236/)

**Verified evidence:** ACL 2026 REaR separates semantic relevance from structural joinability in an LLM-free retrieve/expand/refine pipeline and reports improvements for dense and sparse retrievers on BIRD, MMQA, and Spider with lower latency than LLM-augmented alternatives. [ACL Anthology](https://aclanthology.org/2026.acl-long.1826/)

**Conclusion for this project:** Retrieve fields/metrics/filters as typed semantic cards, then expand reviewed dependency edges such as metric-to-grain/formula or UUPG-to-criterion fields. Do not rely on independent similarity scores to assemble a logically complete context, and do not introduce a model-derived knowledge graph.

### More context can reduce answer quality

**Verified evidence:** ICLR 2025 research finds that answer quality can decline as more retrieved passages are added, identifying hard negatives as a contributor and showing value from retrieval reordering. [ICLR Proceedings](https://proceedings.iclr.cc/paper_files/paper/2025/hash/5df5b1f121c915d8bdd00db6aac20827-Abstract-Conference.html)

**Conclusion for this project:** Keep a six-item/8 KiB ceiling, create hard-negative tests, pin exact/current-view evidence, select for set coverage, and version prompt ordering. A larger Qwen context window is not permission to send all 241 definitions or all resource payloads.

### Contextualized chunks improve retrieval, but vendor results require local validation

**Verified evidence:** Anthropic’s engineering evaluation prepends short document-specific context to each chunk before both lexical and embedding indexes. It reports lower top-20 retrieval failure across its evaluated domains, with larger improvements for contextual lexical+dense retrieval and reranking. These are vendor-reported experiments, not an Accelerate Global benchmark. [Anthropic Engineering](https://www.anthropic.com/engineering/contextual-retrieval)

**Conclusion for this project:** Generate deterministic context prefixes from trusted card fields—dataset, grain, kind, label, scope, filter/resource identity, and version. Do not use an ingestion-time LLM to summarize structured metadata.

### Focused terminology/schema grounding and examples can help smaller models

**Verified evidence:** ACL 2025 ADEPT-SQL combines terminology expansion, focused schema alignment, historical-query retrieval, and few-shot examples; its paper reports high execution accuracy in a deployed petroleum domain using smaller open-source models. [ACL Anthology](https://aclanthology.org/2025.acl-demo.27/)

**Verified evidence:** ACL 2025 DCG-SQL represents question/schema relationships to retrieve useful demonstrations and reports improvements across both large and smaller models on Spider. [ACL Anthology](https://aclanthology.org/2025.acl-long.748/)

**Verified evidence:** EMNLP 2025 SAFE-SQL reports gains from carefully selected examples, including difficult/unseen cases, but generates examples at runtime with an LLM. [ACL Anthology](https://aclanthology.org/2025.emnlp-main.962/)

**Conclusion for this project:** Retrieve zero to two human-reviewed question-to-semantic-plan examples from a small, versioned pool derived from sanitized fixtures. Never generate examples at runtime, never include SQL, never use production conversations, and prevent test leakage by grouping/deduplicating intent and plan skeletons before train/dev/holdout splitting.

### Local open-source embedding and reranking candidates

**Verified evidence:** Qwen’s official 0.6B embedding model is Apache-2.0, instruction-aware, supports up to 1,024 dimensions and more than 100 languages, and has documented local Sentence Transformers, Transformers, vLLM, and CPU/GPU TEI paths. [Official model card](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B) and [official repository](https://github.com/QwenLM/Qwen3-Embedding)

**Verified evidence:** Qwen’s official 0.6B reranker is Apache-2.0 and exposes local CrossEncoder/Transformers paths. [Official model card](https://huggingface.co/Qwen/Qwen3-Reranker-0.6B)

**Conclusion for this project:** These are the first dense/rerank candidates because they are local, small relative to the generative model, instruction-aware, multilingual, license-compatible, and maintained by Qwen. Their general benchmarks do not replace a Samson concurrency and Accelerate Global relevance benchmark.

### Use existing PostgreSQL/Supabase capabilities before another platform

**Verified evidence:** Supabase documents hybrid PostgreSQL search using full-text search plus pgvector and reciprocal-rank fusion. [Supabase hybrid search](https://supabase.com/docs/guides/ai/hybrid-search)

**Verified evidence:** pgvector supports hybrid search with PostgreSQL full-text search and either reciprocal-rank fusion or a cross-encoder. Its default exact nearest-neighbor search provides perfect recall; approximate indexes trade recall for speed. [pgvector](https://github.com/pgvector/pgvector)

**Verified evidence:** Supabase documents applying Row Level Security to vector sections so similarity search respects access policy. [Supabase RAG with permissions](https://supabase.com/docs/guides/ai/rag-with-permissions)

**Conclusion for this project:** Use the existing private Supabase/Postgres boundary. Start with full-text search; if dense passes, store snapshot-bound embeddings in pgvector and use exact search because the corpus is small. Do not add Pinecone, Weaviate, Qdrant, Milvus, Elasticsearch, or another managed service. Do not add HNSW/IVFFlat until exact search fails a measured scale target.

### Evaluate retrieval and generation separately

**Verified evidence:** NeurIPS 2024 RAGChecker provides fine-grained metrics for retrieval and generation and reports stronger correlation with human judgments than compared metrics. [NeurIPS](https://proceedings.neurips.cc/paper_files/paper/2024/hash/27245589131d17368cccdfa990cbf16e-Abstract-Datasets_and_Benchmarks_Track.html)

**Verified evidence:** NAACL 2024 ARES evaluates context relevance, answer faithfulness, and answer relevance, and calibrates lightweight judges with a small human-labeled set. [ACL Anthology](https://aclanthology.org/2024.naacl-long.20/)

**Verified evidence:** EACL 2024 RAGAS defines separate retrieval focus, faithfulness, and generation-quality metrics without requiring reference answers. [ACL Anthology](https://aclanthology.org/2024.eacl-demo.16/)

**Verified evidence:** The NeurIPS BEIR benchmark found BM25 to be a robust baseline and reranking/late interaction strong on average but computationally costly. [BEIR](https://arxiv.org/abs/2104.08663)

**Conclusion for this project:** Maintain human relevance labels and deterministic gold plans/results as primary gates. Report Recall@6, nDCG@6, MRR, required-set coverage, hard-negative/irrelevant-context rate, latency, and bytes for retrieval; measure typed-plan validity, execution/result accuracy, evidence-claim precision, faithfulness, clarification, abstention, and refusal separately. Automated judges are secondary diagnostics calibrated against human-reviewed cases.

### Retrieval is a security boundary

**Verified evidence:** OWASP’s RAG guidance calls for document hashing, bounded/delimited context, permission metadata on each chunk, query normalization, output validation, full observability, fail-closed behavior, and index integrity; it separately identifies document poisoning and embedding manipulation. [OWASP RAG Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)

**Verified evidence:** Microsoft’s August 2026 retrieval-hygiene guidance treats every prompt, document, chunk, tool result, and memory write as untrusted data and calls for schema-valid extraction, permission-aware indexing, provenance, versioning, rollback, and typed policy-checked interfaces. [Microsoft Learn](https://learn.microsoft.com/en-us/security/zero-trust/catalog-ai-defense-capabilities/input-context-retrieval-hygiene)

**Conclusion for this project:** Only reviewed immutable snapshots are searchable. Permission/scope filters occur before ranking. Cards and embeddings inherit source/sensitivity/audience metadata and checksums. Runtime cannot write the index. Retrieved text is a data-only schema and cannot grant query authority. Internal signed lineage remains even though the visible “Data provenance” panel is removed.

## Methods considered but not selected

### GraphRAG

Microsoft GraphRAG builds LLM-derived entity/community graphs for local and global summarization of large unstructured corpora. It is mature enough to consider, but its graph extraction, community summaries, indexing artifacts, and model cost solve a different problem from this small, already-structured semantic registry. [Microsoft Research](https://www.microsoft.com/en-us/research/project/graphrag/publications/) and [GraphRAG 1.0](https://www.microsoft.com/en-us/research/blog/moving-to-graphrag-1-0-streamlining-ergonomics-for-developers-and-users/)

Decision: do not adopt. Use explicit reviewed dependency edges already present in the semantic model.

### RAPTOR/hierarchical summary trees

RAPTOR recursively clusters and summarizes long documents to retrieve at multiple abstraction levels and reports gains on long, multi-step question answering. [ICLR 2024](https://proceedings.iclr.cc/paper_files/paper/2024/hash/8a2acd174940dbca361a6398a4f9df91-Abstract-Conference.html)

Decision: do not adopt for atomic fields, metrics, filters, and resource summaries. Re-evaluate only if long unstructured manuals or reports become an approved corpus.

### Self-RAG, corrective/agentic RAG, and exploratory SQL probes

Self-RAG trains a generator to emit retrieval/reflection tokens; CRAG adds a retrieval evaluator and web fallback; ACL 2026 SDE-SQL lets the model generate and execute exploratory SQL probes. [Self-RAG, ICLR 2024](https://openreview.net/pdf?id=hSyW5go0v8), [CRAG](https://arxiv.org/abs/2401.15884), and [SDE-SQL, ACL 2026](https://aclanthology.org/2026.acl-long.116/)

Decision: do not adopt. Training Qwen is out of scope; web fallback violates the approved-data boundary; exploratory model-written SQL violates the deterministic typed-plan invariant. Borrow only the fail/clarify-on-low-evidence principle.

### Full-context prompting

Decision: do not adopt. Current research on hard negatives and the known conflicts in mutable definitions make full-registry prompting less reliable, not more intelligent.

### Hosted vector database or broad RAG framework

Decision: do not adopt. PostgreSQL/Supabase already provide the needed full-text, vector, fusion, and RLS primitives. LangChain/LlamaIndex/Haystack could orchestrate these pieces, but this narrow typed pipeline does not need their agent/tool abstraction or another operational dependency.

## Proposed promotion gates

- Exact key/alias, named-filter, and resolver-critical retrieval: 100% Recall@1.
- Release-blocking multi-concept questions: 100% required-evidence set coverage.
- Held-out paraphrases: at least 95% Recall@6.
- Security: zero excluded, wrong-audience, stale, or authority-widening cards; no critical hard negative in final context.
- Hybrid promotion: at least three absolute points of held-out Recall@6 or nDCG@6 improvement, or at least three predeclared material failures fixed, with no critical regression.
- Reranker promotion: the same material-gain rule over hybrid.
- Lexical p95: under 25 ms.
- Hybrid incremental p95: at most 250 ms.
- Reranker incremental p95: at most 500 ms.
- Samson: no swap, at least 10% of allocated RAM/VRAM remains free under sustained canary load, no new generative queue failures, and no more than 5% degradation in generative Qwen p95.
- Context: at most six retrieved items, at most two demonstrations, at most 8 KiB serialized.

These thresholds are proposed review defaults. They should be frozen before tuning and changed only through a reviewed rationale, never after seeing sealed holdout results.

## Owner review decisions

On August 31, 2026, Blake approved the 30-minute view-context lifetime and all proposed retrieval quality/resource gates. Blake is the semantic conflict approver for the pilot and directed that runtime definition resources and their human guiding documents remain synchronized through one bidirectional candidate workflow. Phase one will provide deterministic ROP definition and exact-code lookup without bulk catalog traversal, unapproved ROP data filtering, or model-selected joins. The UUPG quick reference will visibly explain its null-preserving behavior and distinguish the interactive filter from the stricter Baseline UUPG pipeline.

## Changes made to the implementation plan

- Replaced the custom in-process lexical scorer as the only planned production method with a PostgreSQL full-text baseline and a predeclared local hybrid/rerank bakeoff.
- Added deterministic contextual card text, typed dependency expansion, set-coverage selection, and controlled signed multi-turn query views.
- Added a separately reviewed semantic-plan demonstration pool with strict holdout separation.
- Added Qwen3-Embedding-0.6B and Qwen3-Reranker-0.6B as conditional local candidates and explicitly rejected approximate indexes at current scale.
- Added separate retrieval/generation metrics, material-promotion gates, Samson concurrency limits, hard-negative cases, embedding/index integrity, and lexical fallback confidence rules.
- Explicitly rejected GraphRAG, RAPTOR, autonomous/self-corrective RAG, runtime-generated examples, model SQL probes, web fallback, and an external vector platform for this release.
