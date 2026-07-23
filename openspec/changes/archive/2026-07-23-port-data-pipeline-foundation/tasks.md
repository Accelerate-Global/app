## 1. Legacy contract characterization

- [x] 1.1 Add a complete flow inventory with evidence labels and source-to-online stage mappings.
- [x] 1.2 Add a decision log covering unresolved retention, precedence, namespace, duplicate, and publication rules.
- [x] 1.3 Add sanitized source, identity, merge, and aggregate fixture inputs with deterministic expected outputs.
- [x] 1.4 Add an offline comparison command and focused tests that never require AX Data, provider, Drive, secret, or production access.

## 2. Shared forming contracts

- [x] 2.1 Add generic forming statuses, findings, validation, artifacts, bindings, engine declaration, context, and result types with direct contract tests.
- [x] 2.2 Add a fail-closed forming-engine registry and eligibility policy with unsupported, ambiguous, stale, decision, and publication tests.
- [x] 2.3 Add generic resource-binding resolution and checksum validation with complete, missing, incompatible, and code-contract test cases.
- [x] 2.4 Add generic candidate storage path/helpers while preserving existing IMB artifact paths and direct storage tests.

## 3. IMB compatibility migration

- [x] 3.1 Register the existing IMB transform behind the generic engine contract without changing its pure output.
- [x] 3.2 Move or wrap IMB lifecycle operations behind generic policy and response hydration while retaining existing imports and route contracts.
- [x] 3.3 Add a golden compatibility test proving identical IMB columns, rows, findings, lineage, and output checksum through the adapter.
- [x] 3.4 Update API-run forming eligibility to use the registered engine while preserving non-engine import behavior.

## 4. Persistent metadata and security

- [x] 4.1 Generate an additive Supabase migration for engine metadata, artifact schema, ordered resource bindings, backfill, constraints, indexes, RLS, and browser-role revokes.
- [x] 4.2 Update the Drizzle schema and schema tests for generic forming metadata and compatibility projections.
- [x] 4.3 Add database security and constraint tests for backfill, immutable finalized bindings, valid engine metadata, and unauthorized access denial.
- [x] 4.4 Verify candidate finalization/publication cannot produce a false published state after storage or dataset-write failure.

## 5. Pipeline resource foundations

- [x] 5.1 Add typed definitions and adapters for source aliases, JP PeopleID3, PEID, Tier 1 merge priorities, and engagement mappings.
- [x] 5.2 Add code-defined version/checksum contracts for reviewed field and transformation rules.
- [x] 5.3 Add resource validators and fixtures for schema, uniqueness, active state, cross-reference integrity, and approved bounded missing-parent warnings.
- [x] 5.4 Extend immutable resource-set resolution and health checks to validate registered engine requirements.
- [x] 5.5 Add resource-impact queries that report affected engines and older candidate/publication bindings without automatic rebuilds.

## 6. Admin API and run-detail UI

- [x] 6.1 Extend guarded forming APIs with generic engine and resource-binding response data while preserving existing IMB URLs.
- [x] 6.2 Update the run-detail sheet to render generic engine lifecycle, bindings, findings, downloads, and decisions with contained copyable values.
- [x] 6.3 Add or update route, component, accessibility, literal smoke-attribute, and UI journey coverage for the generic candidate surface.

## 7. Documentation and verification

- [x] 7.1 Update current-state and operator documentation for the shared lifecycle, resource declarations, compatibility, retry, deployment, and rollback.
- [x] 7.2 Run `pnpm run verify:fast`, all direct tests required by changed same-stem files, `pnpm run smoke:check`, and `pnpm run spec:validate` to green.
- [x] 7.3 Run `pnpm run verify:change`, complete every listed command, then pass `pnpm run verify:change:run`.
- [x] 7.4 Verify the implementation against this OpenSpec change and archive it before `pnpm run verify:ship:local` or release work.
