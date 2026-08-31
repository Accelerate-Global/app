## Why

Private Qwen currently receives a small static semantic catalog but no validated dataset-view context and no on-demand access to the broader field, filter, source-contract, pipeline, and reference-resource knowledge already maintained by Accelerate Global. The production 100-versus-103-versus-104 incident also showed that a bounded record page can be mistaken for a total and that the table and chat paths can apply different semantic predicates.

## What Changes

- Add a lightweight, versioned semantic-context retrieval layer over reviewed Accelerate Global metadata; use exact aliases and deterministic lexical retrieval before considering embeddings.
- Keep the existing query catalog as the sole queryability allowlist. Retrieved metadata may explain approved concepts but MUST NOT automatically expose fields, joins, values, or tools.
- Establish one shared named-filter registry used by the dataset table, current-view context, planner contract, and SQL compiler. The existing UUPG filter behavior—including enabled criteria and blank-value matching—is authoritative.
- Add an authenticated **Ask Qwen about this view** handoff from the approved primary dataset, with a short-lived server-signed context containing the exact dataset version and active filters.
- Display current-view filter chips and quick-reference prompts in chat while allowing the user to clear the context.
- Extend the typed plan with approved named filters and extend query results with mode, requested limit, returned count, matching count, and completeness (`hasMore`).
- Prevent Qwen from describing a bounded record page as a total. Numeric fact bullets and count/list scope SHALL be produced or validated deterministically, with a deterministic fallback on disagreement.
- Promote curated field definitions, aliases, types, units, null semantics, source lineage, pipeline/filter definitions, and reference-resource summaries into a checksum-bound semantic-context snapshot after conflict review.
- Add regression, parity, retrieval, security, grounding, and end-to-end tests, including the exact Sudan UUPG/frontier and 100-row-limit incident.
- **Non-goals:** Qwen will not receive database credentials, generate executable SQL, query arbitrary uploaded columns, read unrestricted resource payloads, execute tools, persist raw conversation history, or replace the deterministic compiler and read-only analytics role.

## Capabilities

### New Capabilities

- `semantic-context-retrieval`: Versioned, reviewed, permission-aware retrieval of relevant business definitions and resource summaries for Qwen planning and narration without widening query authority.

### Modified Capabilities

- `semantic-analytics-query`: Add shared named-filter semantics, result-completeness metadata, deterministic numeric-claim enforcement, and retrieval lineage while retaining typed plans and deterministic parameterized SQL.
- `private-data-chat`: Add validated current-view handoff, filter quick references, context lifecycle, and grounded responses that distinguish matching totals from returned pages.

## Impact

- Chat planning, orchestration, gateway contracts, schemas, compiler, broker, audit evidence, and evaluation suites under `src/lib/private-data-chat/` and `src/app/api/chat/`.
- Dataset filter definitions and table state under `src/lib/dataset-filtering.ts` and `src/components/dashboard/`.
- A new server-owned semantic-context builder/retriever sourced from field definitions, source contracts, pipeline semantic contracts, named filters, and active reference-resource metadata.
- Supabase may gain private version/entry storage for the semantic-context snapshot or extend the existing reference-resource lifecycle; RLS, least-privilege analytics grants, and read-only execution remain mandatory.
- The chat request and gateway payload contracts change in a backwards-incompatible, versioned manner for the private pilot; no public API is introduced.
- UI smoke coverage expands for the dataset-to-chat handoff, filter chips, stale context, clear-context behavior, and capped-list wording.
- Vercel and Samson require coordinated prompt/schema hash rotation and a fresh pinned Qwen evaluation receipt. No new hosted vector database or external retrieval service is planned.
