## 1. Planning and Verification Setup

- [x] 1.1 Run `pnpm run verify:change` and the AI/admin/DB/UI task kickoff before application edits.
- [x] 1.2 Validate the OpenSpec proposal, design, and three capability specs with `pnpm run spec:validate`.

## 2. Semantic Query Core

- [x] 2.1 Add the versioned primary people-groups semantic catalog and strict query-plan/result/provenance schemas with unit tests.
- [x] 2.2 Add the deterministic parameterized SQL compiler and policy limits with unit and adversarial/property-style tests.
- [x] 2.3 Add sanitized evaluation fixtures covering aggregation, grouping, filters, empty results, ambiguity, unsupported requests, and the prior literal/macro-region regressions.

## 3. Supabase Analytics Boundary

- [x] 3.1 Add a tracked migration for the approved typed analytical projection, constrained database roles/grants, RLS-preserving identity context, resource limits, and redacted audit metadata.
- [x] 3.2 Add the server-side read-only query broker with separate configuration, bounded transaction behavior, provenance, and normalized errors.
- [x] 3.3 Add pgTAP and integration tests for positive/negative identities, restricted datasets, write/relation/function denial, empty results, limits, and audit redaction.

## 4. Private Qwen Contract

- [x] 4.1 Add the server-only signed Qwen gateway client, schema-constrained plan/answer operations, timeout/cancellation/error normalization, and tests.
- [x] 4.2 Add a deterministic fake gateway for routine unit, route, local Supabase, and UI smoke verification.
- [x] 4.3 Add Samson gateway/tunnel service artifacts, hardened configuration, deployment/rollback runbook, and sanitized real-Qwen benchmark v2 without enabling live public connectivity.
- [x] 4.4 Add the personal-account `workers.dev` edge relay, generated Wrangler VPC Service binding, strict route/header/body boundaries, focused tests, and deployment runbook without live provider writes.
- [x] 4.5 With exact provider approval, enable Zero Trust Free and provision the personal-account Tunnel, VPC Service, Access-protected Worker, and service token; connect Samson and Vercel while the feature remains disabled.

## 5. Chat API and UI

- [x] 5.1 Add admin-only feature-flag and configuration helpers with direct permission/configuration tests.
- [x] 5.2 Add the guarded chat orchestration API with bounded ephemeral history, plan validation/repair, query execution, grounded fallback, provenance, progress streaming, and route tests.
- [x] 5.3 Add the authenticated dashboard chat page and accessible client UI for progress, clarification, answers, provenance, empty results, cancellation, retry, unavailable, timeout, and busy states with component/page tests.
- [x] 5.4 Add navigation, route-registry, literal smoke markers, deterministic smoke bootstrap, and targeted browser journeys for pilot and non-pilot roles.

## 6. Integrated Evaluation and Capacity

- [x] 6.1 Run the expanded deterministic suite end to end through fake inference, compiler, local Supabase, answer grounding, and authorization contexts.
- [x] 6.2 Run the pinned real-Qwen suite against Samson for three deterministic repetitions and save a hash-verified evaluation receipt.
- [x] 6.3 Verify queue, cancellation, timeout, restart, tunnel-offline, database-offline, prompt-injection, log-redaction, context-limit, and one/two/four-user behavior.

## 7. Repository Gates and Handoff

- [x] 7.1 Run `pnpm run verify:fast`, direct touched tests, `pnpm run smoke:check`, and `pnpm run db:security`, fixing any product, test-gap, harness, or environment failures.
- [x] 7.2 Rerun `pnpm run verify:change`, complete every required command including targeted UI smoke, and pass `pnpm run verify:change:run`.
- [x] 7.3 Update current-state and operator documentation, record unresolved provider-owned staging/Cloudflare/secret decisions, and verify rollback with the feature disabled.
- [x] 7.4 Verify the OpenSpec change against implementation, archive it, and pass `pnpm run verify:ship:local` before any release request.
