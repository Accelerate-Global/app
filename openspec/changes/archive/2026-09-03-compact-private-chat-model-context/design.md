## Context

The first latency release removed the second model call from validated analytical queries. Repeated identical production questions then completed in 24.7–27.0 seconds, but the first varied end-to-end cases still evaluated 2,643–3,085 prompt tokens and spent 45.4–52.7 seconds in prompt ingestion. Inspection found that `PrivateDataChatRetrievalReady` contains both `items` and a `serialized` envelope containing the same items, alongside views, hashes, byte counts, and exact-match metadata used by application validation and audit. The HTTP gateway forwards that full object into the model's final user message.

## Goals / Non-Goals

**Goals:**

- Remove duplicate semantic evidence and audit-only metadata from planner inference input.
- Preserve the exact selected reviewed items, policy identity, instruction/data boundary, and every downstream safety control.
- Measure varied-question prompt-token and end-to-end latency rather than relying on repeated identical prompts.

**Non-Goals:**

- Changing retrieval ranking, selected-card limits, semantic definitions, prompts, schemas, model/runtime, SQL, RLS, canary scope, Cloudflare, or Samson configuration.

## Decisions

1. Build the model envelope from typed retrieval fields instead of parsing the stored serialized copy. The envelope contains only `type`, `policyVersion`, `instructionAuthority: false`, and `items`; it is semantically identical to the reviewed evidence serialization already produced by retrieval.
2. Keep the full retrieval object in the orchestrator. Snapshot/policy checksums, retrieval views, exact keys, selected checksums, bytes, and latency remain available for validation and redacted audit evidence.
3. Do not compact item definitions in this change. Removing fields from each reviewed item could affect planning quality and would require a broader semantic contract change.
4. Qualify with the unchanged end-to-end suite and Samson prompt-eval counters. Rollback is the prior application commit; no provider or database rollback is required.

## Risks / Trade-offs

- **Risk:** The model previously observed retrieval metadata even though it was not semantic evidence. → The complete frozen canary must prove decisions and grounded outputs remain unchanged.
- **Risk:** Prompt savings vary with selected card count. → Report varied-suite prompt-token and browser p50/p95 distributions, not one repeated question.
