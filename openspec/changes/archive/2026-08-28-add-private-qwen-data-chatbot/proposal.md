## Why

Accelerate Global needs an authenticated conversational interface that can answer questions about approved workspace data using the privately hosted Qwen 3.6 model without making model output, model connectivity, or model-generated SQL a security boundary. The existing Samson deployment proves local inference is viable, but the current synthetic benchmark and Vercel/Supabase application do not yet provide a production-safe semantic query contract, authorization-aware broker, or user interface.

## What Changes

- Add an admin-only, feature-flagged data-chat surface and guarded streaming API to the existing authenticated dashboard.
- Add a versioned semantic analytics catalog and a strict structured query-plan contract; Qwen will never supply executable SQL or database credentials.
- Add a deterministic parameterized SQL compiler, independent admission policy, bounded read-only query execution, provenance, and privacy-preserving audit metadata.
- Add approved typed analytical projections that preserve existing workspace-visible versus restricted dataset access and Supabase RLS behavior.
- Add a hardened server-only Qwen client contract for a machine-authenticated Samson gateway, with a deterministic local fake for routine tests.
- Add a narrow Cloudflare Worker relay on the selected personal account's `workers.dev` hostname, protected by Access and bound to one Workers VPC Service so no custom DNS zone or public tunnel hostname is required.
- Expand sanitized model evaluation, database security, API, UI smoke, failure-mode, and capacity coverage before the feature can leave the administrator pilot.
- Stage but do not silently create live Cloudflare, Samson firewall, Vercel-secret, or production Supabase resources; those provider changes require verified targets, explicit rollout steps, and rollback validation.

Non-goals:

- No write, publication, pipeline, dataset mutation, or administrative action may be initiated by chat.
- No arbitrary natural-language-to-SQL execution and no direct query access to raw uploaded JSONB rows.
- No browser access to Samson, llama.cpp, database credentials, Cloudflare service credentials, or provider secrets.
- No persistent raw prompts, parameter values, query results, or conversation history in the initial pilot.
- No change to existing dataset upload, pipeline, saved-table, map, or user-management behavior.

## Capabilities

### New Capabilities

- `private-data-chat`: Authenticated, feature-flagged conversational data exploration with clarification, grounded answers, provenance, bounded context, and safe failure behavior.
- `semantic-analytics-query`: Versioned semantic catalog, structured query plans, deterministic parameterized SQL compilation, authorization-aware read-only execution, and privacy-preserving audit evidence.
- `private-model-gateway`: Server-only, machine-authenticated connectivity to local Qwen inference with request signing, replay resistance, limits, queue/error contracts, and no direct browser or database access.

### Modified Capabilities

- None. Existing authenticated dataset access, workspace role, API-route security, pipeline, and deployment behavior remains authoritative and is consumed by the new capabilities without weakening its requirements.

## Impact

- Application: new code under `src/app/dashboard`, `src/app/api`, `src/components`, and `src/lib` for the chat page, API, orchestration, semantic catalog, compiler, broker, gateway client, and tests.
- Database: tracked Supabase migrations, Drizzle declarations where appropriate, and pgTAP tests for analytical projections, grants, RLS, read-only execution, limits, and audit metadata.
- UI smoke: a new route-registry entry, literal page/ready markers, chat surface markers, and targeted browser journeys are required by `docs/testing/ui-smoke.md`.
- Auth and permissions: the pilot is limited to `admin` and `super_admin`; identity continues to come from trusted `raw_app_meta_data.workspace_role` through `src/lib/auth.ts` and `src/lib/workspace-role.ts`.
- API and security: the chat API must use `src/lib/route-guard.ts`, centralized same-origin mutation enforcement in `src/proxy.ts`, private no-store responses, normalized provider errors, payload/rate limits, and server-only secrets.
- Supabase: approved analytical views must be non-browser-owned and security-invoker, backed by a locked no-argument projection that independently preserves the trusted pilot authorization outcome, explicitly granted to a dedicated non-bypass read-only role, and exercised through local database security tests.
- Vercel and Samson: the deployed app remains on Vercel as documented in `docs/architecture/current-state.md`; live Qwen access requires a separately approved outbound-only tunnel and hardened internal gateway consistent with `/Users/blake/Documents/ChatGPT/Samson/local-llm/database-boundary.md`.
- Cloudflare edge: tracked Worker code and Wrangler configuration live under `infra/cloudflare/qwen-edge-gateway`; live Zero Trust enrollment, tunnel, VPC Service, Worker deployment, Access policy, and service-token creation remain explicit provider changes.
- Verification: `pnpm run verify:change`, task kickoff, direct tests, `pnpm run smoke:check`, `pnpm run db:security`, targeted UI smoke, the real-Qwen evaluation receipt, and `pnpm run verify:change:run` are release-blocking for their impacted slices.
