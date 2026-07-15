## 1. Implementation kickoff and contract fixtures

- [x] 1.1 Run `pnpm run verify:change` and `pnpm run task:kickoff -- --scope "src/lib/partner-exports/**,src/app/api/admin/**,src/components/dashboard/**,src/db/schema.ts,supabase/migrations/**,tests/ui/route-registry.ts"`; record the impacted domains, required commands, targeted smoke subset, local Supabase need, and unrelated dirty paths before editing application code.
- [x] 1.2 Create redacted, synthetic source-dataset fixtures and a Joshua Project contract fixture; assert the exact 13 output headers/order, omission of `index` and `Row number`, source-key (not position) lookup, and preservation of identifier strings.
- [x] 1.3 Define typed profile, mapping, transform, validation, run, provenance, and artifact contracts with bounded row/byte limits and normalized error shapes.

## 2. Private data model, storage, and connection lifecycle migration

- [x] 2.1 Extend the Drizzle schema and committed Supabase migration with private partner export profile, ordered profile-column, and export-run records, including provenance/profile snapshots, audit actor fields, indexes, and immutable artifact metadata.
- [x] 2.2 Add private partner-export artifact Storage configuration and RLS/privilege policies for CSV and JSON artifacts; ensure application-server upload/download is the only access path and no public URL is created.
- [x] 2.3 Add non-destructive Google Sheets connection archival fields and an active-only unique source identity constraint for provider plus spreadsheet ID plus stable sheet ID; backfill active rows and archive legacy duplicate active connections without deleting associated history or artifacts.
- [x] 2.4 Update API-connection types, database schema tests, migration assertions, and database-security coverage for archived connection behavior, private export records, and Storage policies.

## 3. Google Sheets connection hardening

- [x] 3.1 Update Google Sheets creation to preflight active source conflicts, report friendly per-tab conflicts, make mixed duplicate/new tab submissions atomic, and reactivate the most recent matching archived connection without duplicating its target dataset or history.
- [x] 3.2 Resolve every service-account access check and refresh from fresh spreadsheet metadata by stable `sheetId`; synchronize safe title/display metadata on rename and fetch values with the resolved title.
- [x] 3.3 Make API connection list, detail, disconnect, and run scheduling paths archive-aware: archive instead of delete, retain authorized history/output downloads, block new runs, and fail a queued run that is archived before execution without fetching or mutating its dataset.
- [x] 3.4 Add or update same-stem Google Sheets provider, API-connection domain, migration, route, and component tests for duplicate prevention, reconnect/reactivation, tab rename, tab deletion, archive retention, and the queued-run race.

## 4. Partner export mapping and generation engine

- [x] 4.1 Implement profile repository and save-time validation that scopes a profile to one physical dataset, uses normalized `CsvColumn.key` mappings with label snapshots, enforces unique ordered target headers, and detects stale source schemas.
- [x] 4.2 Implement the closed transformation allow-list and reusable validation engine, including copy/trim, ordered coalesce, literal, lossless whole-number, ISO timestamp, and non-negative whole-number behavior; reject lossy/ambiguous values and arbitrary expressions.
- [x] 4.3 Implement the Joshua Project starter profile with exact header order, exact-header-only suggestions, no semantic fallback to aggregate mapping metadata, visible unresolved mappings, and documented field-level validation policy.
- [x] 4.4 Implement deterministic preview from row-index-ordered source rows, bounded samples, structured error/warning findings, and explicit warning acknowledgement without persisting a CSV artifact.
- [x] 4.5 Implement queued export runs that snapshot source dataset ID, blob path, current-version time, schema/row fingerprint, profile revision, actor, validation summary, output checksum, and immutable private CSV/crosswalk/validation artifacts; clean up unlinked objects on persistence failure.
- [x] 4.6 Reuse safe CSV escaping and formula neutralization for every exported value; add focused unit and integration tests for transformations, ordering, stale mappings, validation severity, provenance, artifact cleanup, and no source-data mutation.

## 5. Admin API and dataset export experience

- [x] 5.1 Add administrator-authorized partner export profile, preview, run, run-detail, and artifact-download routes with existing same-origin mutation protection, strict request validation, normalized provider-free errors, and no public Storage URLs.
- [x] 5.2 Add an admin-only Partner exports section to the existing dataset detail experience with profile list/history, Custom and Joshua Project template creation, ordered column mapping, crosswalk, preview/validation state, explicit warning acknowledgement, generation status, and local download actions.
- [x] 5.3 Add literal `data-smoke-trigger`, `data-smoke-surface`, and `data-smoke-ready` attributes for mapping and export-run interactive surfaces; update any affected shared-primitive smoke fixtures and `tests/ui/route-registry.ts` only if a new page route is introduced.
- [x] 5.4 Add or update same-stem route and component tests for admin authorization, validation errors, preview/generation state, private download behavior, Joshua Project output presentation, and the required UI smoke interactions.

## 6. Documentation and verification

- [x] 6.1 Document the service-account-only Sheet connection workflow, profile mapping/crosswalk review, Joshua Project starter assumptions, validation handling, private local-download behavior, archive/reconnect semantics, and explicit v1 exclusions (OAuth, Drive browsing, scheduling, joins, and delivery).
- [x] 6.2 Run direct tests for every changed module, then run `pnpm run verify:fast`; classify and fix each failure before proceeding.
- [x] 6.3 Run `pnpm run smoke:check`, required local Supabase migration/RLS checks including `pnpm run db:security`, and the targeted UI smoke subset identified by `pnpm run verify:change`; satisfy all required commands reported by the change-impact gate.
- [x] 6.4 Run `pnpm run spec:validate`, rerun `pnpm run verify:change`, and pass `pnpm run verify:change:run` on the final tracked tree; archive this OpenSpec change only after all required verification passes and before any ship-local or ship workflow.
