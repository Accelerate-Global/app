## Context

The application is a Vercel-hosted Next.js App Router project with Supabase Auth, Postgres, Storage, and RLS. Its canonical user identity and workspace role are resolved in `src/lib/auth.ts`; guarded API routes use `src/lib/route-guard.ts`; dataset visibility is enforced in application reads and Supabase policies. Dataset rows are generic JSONB string records, while the user-facing domain already has canonical people-group field keys and definitions in `src/lib/dataset-region-constants.ts`, `src/lib/field-definitions.ts`, and pipeline artifacts.

Samson VM 200 runs pinned Qwen 3.6 through CPU-only llama.cpp on `127.0.0.1:8080`. It is healthy and intentionally has no database credential, public listener, or general egress. The current Qwen benchmark uses sanitized synthetic donor data and proves inference/security compatibility, not production Accelerate Global semantic accuracy. It scored 7/14 under a strict SQL proposal policy because the model embedded literals; diagnostic rebinding raised latent semantic accuracy to 11/14, leaving two grouping-grain errors and one unnecessary refusal.

The change crosses the Vercel application, Supabase database security, a private inference gateway, UI smoke coverage, and a separately maintained Samson deployment record. The deployed app has no supported staging environment today, so live provider configuration must remain feature-flagged and reversible until a non-production or tightly scoped canary path is approved.

## Goals / Non-Goals

**Goals:**

- Let authenticated pilot administrators ask multi-turn questions about one approved current people-groups projection and receive grounded, provenance-bearing answers from local Qwen.
- Make query parameterization, identifiers, access scope, database privileges, limits, and execution deterministic and independent of model behavior.
- Preserve current workspace-visible/restricted dataset access and trusted `raw_app_meta_data.workspace_role` semantics.
- Keep Qwen inference local and free of database credentials, query execution, direct browser access, and raw provider authority.
- Provide deterministic local/CI coverage plus a reproducible real-Qwen evaluation receipt for prompt/catalog/model changes.
- Fail closed with useful clarification, unavailable, timeout, empty-result, and capacity states.

**Non-Goals:**

- Arbitrary SQL generation or access to arbitrary uploaded columns.
- Database writes, pipeline actions, dataset publishing, exports, account actions, or other tool agency.
- Persistent raw conversation history in the pilot.
- General-availability concurrency or high availability on the single Samson host.
- Automatic live Cloudflare, firewall, DNS, Vercel secret, or production migration changes without resolved provider ownership and canary approval.

## Decisions

### 1. Qwen emits a typed semantic plan, never SQL

The model response is constrained to `query`, `clarify`, or `answer` and a JSON Schema. A query selects only versioned catalog keys for dataset, metrics, dimensions, filters, sort, and limit. The server maps those keys to trusted SQL fragments and supplies every user value separately as a parameter.

This removes the benchmark's literal-binding failure by construction and keeps raw identifiers outside the model contract. Prompt-only SQL repair was rejected because it leaves security and correctness probabilistic.

### 2. The pilot supports one canonical primary people-groups projection

The first catalog covers stable keys already used by the product: people identifier/name, country, population, percent evangelical, engagement phase, global engagement, Christianity GSEC, and frontier-group status. Supported operations are bounded counts, sums, averages, grouped summaries, filters, sorts, and record lists. The projection resolves the current physical primary dataset and uses guarded casts for typed values.

Querying arbitrary JSONB was rejected for the pilot because user-defined columns are untyped, difficult to index, and impossible to describe accurately without a per-dataset approval lifecycle. Additional datasets require a new catalog revision and evaluation delta.

### 3. The Vercel backend owns orchestration and database execution

`POST /api/chat` resolves the authenticated identity, enforces the pilot role/feature flag, requests a structured plan from Qwen, validates/compiles it, executes it through a dedicated analytics connection, then asks Qwen to explain only the bounded result. The browser receives a private no-store streamed response and never receives provider credentials or a model endpoint.

Keeping the broker beside Supabase avoids granting the Samson VM database egress or credentials. Running the broker on Samson was rejected because it expands the VM firewall, credential, and incident-response boundary.

### 4. Database access is separately credentialed and authorization-preserving

A dedicated analytics login uses pooled TLS, has no bypass/write/admin privileges, and can select only approved `analytics_ro` views. Every transaction sets server-verified identity claims locally, begins read-only, applies statement/lock/idle/work-memory/result limits, and audits only redacted templates and metadata. The analytical view is `security_invoker` and delegates to a locked-search-path, no-argument projection function whose only entry grant is the constrained reader role. That function independently verifies `auth.uid()` and the trusted admin-capable workspace role before reading the current primary dataset, preserving the pilot authorization outcome without granting the analytics role direct access to public or auth tables.

The existing application `DATABASE_URL` and Supabase `service_role` are not used for analytical execution. If local Supabase cannot faithfully emulate claim propagation through the chosen pooler, implementation pauses rather than substituting application-only filters.

### 5. Private connectivity uses a narrow gateway contract

The application Qwen client targets a server-only HTTPS URL and requires machine credentials plus an application HMAC containing method, path, timestamp, nonce, and body digest. The gateway exposes plan, grounded-answer, and health operations only; it enforces payload/token/time/queue limits and forwards to loopback llama.cpp.

The selected Cloudflare account is a personal account (`06281b845d00a5b3857bf215dec00782`) with no managed DNS zone. The live topology therefore uses an Access-protected Worker on its `workers.dev` hostname. That Worker accepts only health, plan, and answer paths, strips Access credentials and arbitrary headers, and calls one least-privilege Workers VPC Service binding. The VPC Service reaches only the Samson HTTPS gateway at `10.77.0.30:8443` through a remotely managed outbound-only Tunnel connector separate from llama.cpp. No public tunnel hostname, cross-account CNAME, or custom DNS zone is required.

The Samson gateway still independently verifies the application HMAC, timestamp, nonce, content type, body size, and inference limits. The Worker has no HMAC key or database credential and cannot choose another private destination. A deterministic fake gateway implements the same application contract for routine local and UI tests.

### 6. Pilot conversation state is ephemeral and bounded

The browser retains the current conversation and sends a bounded recent window. The server normalizes roles, caps turns/characters, inserts its own system contract, and never trusts client-supplied system or tool messages. Raw prompts, parameters, result rows, and assistant messages are not persisted or placed in logs.

Persistent history was rejected for the pilot because it creates a new sensitive-data retention and deletion system before the analytical boundary is proven.

### 7. Deterministic tests and live-model evaluation are separate gates

Unit, property, route, UI, migration, and pgTAP checks use deterministic fixtures/fakes and remain runnable in the repo. A sanitized real-Qwen suite pins model, runtime, prompt, JSON Schema, catalog, compiler, and fixture hashes; it compares executed result sets and final facts across repeated temperature-zero runs. A fresh receipt is required when any pinned AI contract changes but is not a public CI dependency.

### 8. Release is disabled-first and admin-only

The page and API require `PRIVATE_DATA_CHAT_ENABLED=true`, an exact server-side canary email allowlist match, and an admin-capable workspace role. An empty allowlist fails closed. Provider secrets may be configured before enablement, but absence produces a stable unavailable response. Rollback disables the flag first, then revokes the machine credential and analytics login without affecting existing dataset behavior.

## Risks / Trade-offs

- **Model semantic mistakes remain possible** → constrain the catalog, compare result sets, display provenance, allow one schema repair, and clarify/refuse outside evaluated scope.
- **Two inference phases increase latency** → stream explicit progress, keep prompts/results small, reuse stable prefixes where supported, measure end-to-end percentiles, and return deterministic result formatting if explanation fails.
- **The single inference slot queues users** → enforce a bounded queue/rate limit and keep the pilot small; general availability requires an explicit capacity/availability decision.
- **JSONB-to-typed projection casts can be expensive or malformed** → validate canonical keys, use guarded casts, add expression indexes only for measured query patterns, and test `EXPLAIN`/timeouts on production-shaped synthetic volumes.
- **Direct Postgres claim propagation can be misconfigured** → prove positive, negative, and missing identities in pgTAP/integration tests; use a non-bypass role plus the locked projection's independent `auth.uid()`/trusted-role check; do not rely on application role labels alone.
- **Tunnel or home connectivity failure affects chat** → isolate the feature, expose a clear unavailable state, set short timeouts/circuit breaking, and leave the rest of the application independent.
- **Workers VPC is beta and does not trust the current private origin CA** → bind one explicit VPC Service, keep the feature disabled-first, use bounded end-to-end HMAC authentication, treat HTTPS certificate verification disablement as a documented temporary exception, and migrate to `verify_full` when a publicly trusted or Cloudflare Origin CA certificate is available.
- **Prompts/results may contain sensitive data in transit** → server-only TLS, machine auth, request signing, no browser endpoint, bounded payloads, and no raw logging/persistence.
- **No supported staging environment exists** → complete local synthetic E2E first and require either a separate staging provider stack or a one-user disabled-first production canary approval.

## Migration Plan

1. Add and validate OpenSpec artifacts, semantic/compiler code, deterministic fixtures, and fake-gateway tests with the feature disabled.
2. Add local Supabase migration, analytical role/view/audit boundary, and pgTAP security tests; prove local claim propagation and query limits.
3. Add guarded chat API/UI and UI smoke coverage against the deterministic fake gateway.
4. Extend the Samson sanitized benchmark and implement gateway artifacts without changing live firewall/tunnel state; verify loopback Qwen behavior.
5. In the selected personal Cloudflare account, enable Zero Trust Free, create the dedicated Tunnel and VPC Service, deploy and Access-protect the `workers.dev` relay, install secrets as provider-sensitive values, and run one-user canary tests while the feature remains disabled.
6. Apply the reviewed production migration, verify grants/RLS with non-mutating identities, then enable one super-admin.
7. Expand to administrators only after acceptance gates pass and recorded failures are resolved.

Rollback order: disable the feature flag; revoke/rotate machine credentials; stop the tunnel/gateway; revoke the analytics login; roll back the application deployment. Database views and redacted audit rows may remain because no existing behavior depends on them.

## Open Questions

- Resolved: the selected account uses `blake-062.workers.dev` and Zero Trust team `little-feather-aed2`.
- When will the Samson origin move from its private CA to a certificate Workers VPC can validate with `verify_full`?
- Which production dataset and catalog revision is the first approved analytical source?
- What pilot latency, queue depth, and availability targets are acceptable on the single Samson host?
- When, if ever, should raw conversation history become a separately consented and retained capability?
