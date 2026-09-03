## Why

Post-deploy browser and Samson measurements showed that varied questions still re-evaluate roughly 2,600–3,100 prompt tokens because the application sends selected semantic items twice plus retrieval metadata used only by the application audit. That adds 45–53 seconds of prompt ingestion even after the redundant narrator inference was removed.

## What Changes

- Send Qwen one canonical reviewed-semantic-evidence envelope containing the selected items and retrieval policy version.
- Keep snapshot checksums, retrieval views, exact-match keys, byte counts, and the pre-serialized duplicate in the application for validation and audit only.
- Preserve the pinned model, system prompt, response schema, compiler, read-only broker, canary boundary, and retrieval selection.
- Requalify varied-question prompt ingestion and the complete Blake-only production canary before accepting the optimization.

## Capabilities

### Modified Capabilities

- `private-model-gateway`: Planner context must contain one canonical evidence envelope without duplicating selected items or exposing audit-only retrieval metadata to inference.

## Impact

- Code and tests: `src/lib/private-data-chat/qwen-gateway.ts` and `src/lib/private-data-chat/qwen-gateway.test.ts`.
- Operations: sanitized browser, Cloudflare, gateway, and llama.cpp timing comparison; no model, database, auth, network-topology, or secret change.
