## Why

The shipped private-Qwen chat already prevents model-written SQL, but its planner prompt exposes mostly catalog keys rather than the definitions, aliases, types, units, null behavior, value domains, and metric rules needed to choose those keys reliably. The seven-case deterministic fixture set also leaves too little regression evidence for ambiguous, adversarial, multi-turn, and boundary questions.

## What Changes

- Upgrade the approved people-groups semantic catalog to a versioned, checksum-bound snapshot with dataset grain, curated field and metric semantics, aliases, types, units, null semantics, value domains, compatibility rules, sensitivity, provenance, and freshness metadata.
- Derive that snapshot from the existing field-definition, source-contract, and reference-resource vocabulary where it can be shared safely, while retaining a small explicit allowlist that decides what Qwen may query.
- Give Qwen a compact human-readable planning context generated from the approved snapshot, without physical relation names, SQL expressions, credentials, or unrestricted database values.
- Require query decisions to echo the active catalog version, normalize supported controlled values deterministically before compilation, and fail closed on catalog drift or ambiguous value aliases.
- Give grounded-answer generation only the selected semantic definitions alongside bounded rows and provenance.
- Expand deterministic evaluation to supported, ambiguous, unsupported, adversarial, multi-turn, value-alias, null/boundary, and security cases with golden plans and compiled-query assertions.
- Require a fresh real-Qwen evaluation receipt before release because the prompt, schema, catalog, compiler policy, and fixtures change.
- Preserve the existing deterministic parameterized compiler, read-only broker/view/role, admin canary, Cloudflare gateway, audit-redaction, and result/resource limits.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `semantic-analytics-query`: Strengthen the approved catalog contract, version binding, value normalization, model context, and regression evidence while retaining typed-plan compilation.
- `private-data-chat`: Improve clarification and answer grounding through catalog-derived semantic context and deterministic ambiguity handling.

## Impact

- Affected code: `src/lib/private-data-chat/**`, its direct tests, and the private-data-chat operations runbook.
- API contract: the internal Qwen planning schema gains an active catalog-version field; browser-facing chat request/response shapes remain compatible.
- Data integrity and security: stronger fail-closed planning and value handling; no new database permissions, credentials, tables, views, joins, or mutations.
- Dependencies and operations: no new runtime service, vector store, model framework, or third-party semantic platform. The existing local Qwen/Cloudflare/Vercel path remains unchanged.
- Auth/admin permissions: unchanged; the exact production canary and admin authorization remain in force.
- Supabase and Vercel deployment: no schema migration or provider configuration change is planned, but the normal release gates and real-Qwen receipt still apply.
- UI smoke coverage: unchanged because no page or interaction contract changes.

### Non-goals

- Allowing Qwen to emit or execute SQL, inspect arbitrary schemas or values, choose joins, or receive database credentials.
- Adding Cube, MetricFlow, Malloy, WrenAI, LangChain SQL agents, embeddings, or a vector database for the current nine-field pilot catalog.
- Expanding the approved dataset, adding cross-dataset joins, changing row-level authorization, or relaxing query/resource limits.
