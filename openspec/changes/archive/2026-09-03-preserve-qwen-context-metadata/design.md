## Context

Removing the narrator call improved repeated-query browser p50/p95 to 25.4/27.0 seconds, but varied questions still evaluated 2,643–3,085 prompt tokens. A follow-up canonical-envelope release reduced prompt evaluation to 1,138–1,198 tokens and 19–20 seconds, but its post-deploy canary raised a supported-query quality risk. The synthetic multi-turn signal was invalid because it omitted signed turn state; two single-turn clarifications observed under contention were enough to keep production rolled back while restoring the established metadata shape. The compact gateway had removed both the duplicate serialized items and retrieval metadata Qwen had always observed.

## Decision

Preserve the original validated retrieval object fields and add the existing evidence type/non-instruction marker at the top level. Omit only `serialized`, whose selected `items` are already present structurally. This keeps status, snapshot/policy identity, controlled views, exact keys, byte count, and selected items while removing the dominant duplication.

Do not change the model, prompts, response schema, retrieval selection, compiler, database, or network runtime. Production stays rolled back until the focused failed cases and complete canary pass.

## Risk

The retained metadata may reduce some of the maximum prompt saving. That trade-off is intentional: preserving answer quality and the established context shape is more important than the last few seconds of ingestion reduction.
