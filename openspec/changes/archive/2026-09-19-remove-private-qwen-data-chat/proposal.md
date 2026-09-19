## Why

Private Qwen is a pilot capability with a large application, database, provider, and dedicated-hardware footprint that is no longer wanted in the product. It must be removed through a forward, disabled-first decommission so Accelerate Global does not retain an unreachable model stack, sensitive credentials, private analytics data, or misleading product contracts while preserving unrelated dataset and reference-resource behavior.

## What Changes

- **BREAKING** Remove the Private Qwen data-chat product surface, including `/dashboard/chat`, `/api/chat`, dataset-to-chat handoff, navigation, session state, semantic-context UI/API, and all Qwen-specific runtime, evaluation, test, script, documentation, and Cloudflare Worker source.
- **BREAKING** Remove the Qwen semantic analytics, semantic retrieval, and private model-gateway capabilities from the current product contract.
- **BREAKING** Add a forward Supabase teardown that removes live Qwen audit/continuation/binding/embedding data, analytics views and roles, semantic-context catalog data and Storage objects, and the Qwen-only vector/search state without rewriting applied migrations.
- Preserve ordinary dataset access and UUPG filtering by moving the shared null-preserving UUPG predicate out of the Qwen namespace before that namespace is deleted.
- Preserve the generic Country/ROG and ROP resource catalog, typed resource lifecycle, downloads, activation/rollback, pipeline resource sets, Samson data archive, and unrelated verification hardening.
- Decommission all Qwen-only Vercel variables, Cloudflare Worker/Access/VPC/Tunnel/certificate resources, Samson services and files, and dedicated Samson guests only after the product and database cutover is verified.
- Record a sanitized decommission receipt and negative inventory without retaining secret values, prompts, results, or other private chat payloads.
- Retain normal Git history, archived OpenSpec changes, historical applied migration files, provider audit history, and existing encrypted backups until ordinary retention expiry.

### Non-goals

- Do not rewrite Git history, edit or delete applied migrations, erase archived OpenSpec changes, or prune existing encrypted backup snapshots.
- Do not remove or redesign the normal authenticated dataset viewer, UUPG filter semantics, Country/ROG or ROP resources, reference-resource lifecycle, dataset-forming pipelines, or the separate Samson data-archive guest.
- Do not replace Qwen with another chat model or conversational analytics feature in this change.

## Capabilities

### New Capabilities

- `private-qwen-decommission`: Defines the durable Qwen-free product and infrastructure state, safe cutover ordering, retained shared behavior, historical retention boundary, and decommission evidence.

### Modified Capabilities

- `private-data-chat`: Remove the complete authenticated Private Qwen chat capability and its dataset-view handoff behavior.
- `private-model-gateway`: Remove the complete private Qwen gateway, Cloudflare relay, Samson origin, TLS, observability, and latency-qualification contract.
- `semantic-analytics-query`: Remove the Qwen planning, deterministic chat-query, audit, signed-turn, and semantic regression contract while preserving product-neutral UUPG evaluation outside this capability.
- `semantic-context-retrieval`: Remove the semantic-context catalog, retrieval pipeline, benchmark, embeddings, and guiding-document synchronization contract.
- `rop-code-resource`: Remove conversational ROP access and chat-only dataset-to-ROP query binding while preserving the standalone ROP resource, lifecycle, downloads, security, and UI smoke behavior.

## Impact

- **UI and API contracts:** Qwen navigation and dataset actions disappear; `/dashboard/chat`, `/api/chat`, and the semantic-context resource endpoint return the normal not-found response. UI smoke registration and Qwen browser journeys are removed while remaining routes continue to satisfy the smoke contract.
- **Auth and admin permissions:** No general auth or workspace-role rule changes. Qwen canary admission and its admin-only controls are removed; existing dataset and reference-resource authorization remains unchanged.
- **Data integrity and Supabase:** A new forward migration and Storage cleanup remove only Qwen-owned data and database objects. Existing migrations under `supabase/migrations`, ordinary datasets, resource sets, Country/ROG, and ROP remain intact and gain regression/absence coverage.
- **Vercel deployment:** The rollout disables admission before destructive teardown, then removes every Qwen variable from Production, Preview, and Development after the Qwen-free deployment is healthy.
- **External infrastructure:** Dedicated Cloudflare and Samson resources are removed in ingress-to-origin order. Deleting Samson guest 105 and guest 200 remains an explicit-confirmation checkpoint after immediate target re-verification.
- **Repository:** The principal removal surfaces are `src/lib/private-data-chat/**`, `src/app/api/chat/**`, `src/app/dashboard/chat/**`, `src/components/chat/**`, semantic-context integration under reference resources, `infra/cloudflare/qwen-edge-gateway/**`, Qwen scripts/docs/tests, package configuration, `.env.example`, smoke configuration, and change-impact rules. Brownfield preservation is grounded in `src/lib/dataset-filtering.ts`, `openspec/specs/versioned-reference-resources/spec.md`, `openspec/specs/rop-code-resource/spec.md`, and `docs/testing/verification-first-delivery.md`.
