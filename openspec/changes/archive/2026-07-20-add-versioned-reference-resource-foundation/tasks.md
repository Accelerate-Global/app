## 1. Reconfirm Scope and Verification Contract

- [x] 1.1 Run `pnpm run task:kickoff` with the implementation-owned app, API,
  library, schema, migration, script, test, docs, and OpenSpec paths; record
  unrelated dirty files without modifying them.
- [x] 1.2 Run `pnpm run verify:change` before implementation and record every
  required command, targeted smoke subset, and whether local Supabase is needed.
- [x] 1.3 Capture baseline counts, canonical checksums, representative entries,
  search fields, CSV headers, alias overrides, ROP join-issue counts, and current
  tests for both checked-in generated resources.
- [x] 1.4 Add a short implementation decision record mapping every modified
  current-state loader, route, client, and same-stem test to its replacement or
  compatibility role.

## 2. Build the Database and Storage Foundation

- [x] 2.1 Add a SQL migration for private resource definitions, versions,
  validation findings, activation events, resource sets, and set members with
  UUID keys, `timestamptz`, state/count checks, nonblank constraints, and indexed
  foreign keys.
- [x] 2.2 Add typed Country/ROG entry tables and constraints/indexes for stable
  entry keys, ISO, GENC, FIPS, ROG3, classification, status, names, and aliases.
- [x] 2.3 Add typed ROP term, people, and geography tables with version-scoped
  uniqueness, parent integrity, status/join-issue constraints, and indexes for
  ROP1/2/2.5/3, ISO3, ROG, PeopleID3, and dominant lookup paths.
- [x] 2.4 Add database enforcement that finalized version payload metadata and
  typed projection rows cannot be updated or deleted while keeping lifecycle
  and append-only audit records writable through their intended transitions.
- [x] 2.5 Add short transactional activation/rollback logic with a resource-level
  advisory transaction lock, expected-active compare-and-swap, valid-package
  checks, audit insertion, and immutable resource-set snapshot creation.
- [x] 2.6 Add the private `reference-resource-artifacts` Storage bucket with
  bounded content types/size and no anonymous or direct authenticated access.
- [x] 2.7 Enable RLS and revoke `public`, `anon`, and `authenticated` privileges
  across every private control/projection table and private artifact path.
- [x] 2.8 Add Drizzle schema definitions, relations, inferred types, and
  server-only exports matching the committed SQL source of truth.
- [x] 2.9 Add pgTAP tests for constraints, indexed foreign keys, privileges,
  RLS, immutability, valid/invalid activation, stale conflicts, rollback, audit,
  and resource-set membership.
- [x] 2.10 Reset a clean local Supabase database and run migration lint, database
  security, and generated-schema checks required by `verify:change`.

## 3. Implement the Shared Resource Lifecycle

- [x] 3.1 Define typed resource adapter, version manifest, lifecycle state,
  validation finding, diff, resource set, query, and health contracts.
- [x] 3.2 Implement canonical serialization and SHA-256 content/set checksums
  with deterministic object-key and entry ordering tests.
- [x] 3.3 Extend Storage helpers with resource/version-scoped raw, normalized,
  CSV, validation, and diff artifact paths plus private read/write behavior.
- [x] 3.4 Implement version creation and resumable batched projection writes that
  keep upstream fetches and large ROP inserts outside long activation locks.
- [x] 3.5 Implement finalization that verifies artifacts, counts, adapter schema,
  typed projections, validation findings, and checksum before marking a version
  valid or invalid.
- [x] 3.6 Implement identical-content detection, safe interrupted-build retry,
  candidate rejection, activation, and rollback services over the database
  invariants.
- [x] 3.7 Implement deterministic diff summaries and detailed private diff
  artifacts with added, changed, removed, and adapter-defined high-risk changes.
- [x] 3.8 Implement active and admin-selected version entry queries with bounded
  limits, stable composite cursors, normalized search, and deterministic sorting.
- [x] 3.9 Implement streaming CSV download over the complete matching query
  without materializing the full ROP result in the browser or one memory buffer.
- [x] 3.10 Implement current/by-ID resource-set resolvers without adding a loose
  polymorphic pipeline binding.
- [x] 3.11 Implement health checks for pointers, version state, checksums,
  projection counts, artifacts, set membership, and stale building versions.
- [x] 3.12 Add focused unit/integration tests for every lifecycle transition,
  checksum/diff path, batch boundary, cursor, download, concurrency conflict,
  retry, and health invariant.

## 4. Adapt Country/ROG and ROP to the Foundation

- [x] 4.1 Refactor existing Country/ROG fetch/parse/build validation behind a
  typed adapter without changing trusted sources, current field meanings,
  minimum counts, null semantics, or curated overlay behavior.
- [x] 4.2 Implement Country/ROG typed projection writes, indexed search/query DTO
  reconstruction, CSV mapping, normalized package artifacts, and risk-aware diff.
- [x] 4.3 Refactor existing ROP ArcGIS fetch/parse/flatten validation behind a
  typed adapter without changing hierarchy, geography, parent-only rows, join
  issue semantics, minimum counts, or trusted source behavior.
- [x] 4.4 Implement ROP term/people/geography projection writes, paged flattened
  DTO queries, detail/geography resolution, CSV mapping, artifacts, and
  hierarchy-aware diff.
- [x] 4.5 Add adapter contract tests proving malformed sources, duplicates,
  minimum-count failures, missing parents, null ROG3 behavior, and package
  mismatches become blocking findings without changing the active version.
- [x] 4.6 Add exact parity tests against both generated JSON files for counts,
  representative records, all stable keys, source metadata, join-issue counts,
  details, geography, search fields, and CSV columns.

## 5. Add Deterministic Bootstrap and Reconciliation

- [x] 5.1 Add a tested idempotent bootstrap command that registers the two
  catalog definitions and imports checked-in Country/ROG and ROP through the
  production lifecycle/adapters in bounded batches.
- [x] 5.2 Fold every existing country alternate-name override into the imported
  Country/ROG package and prove the resulting aliases/search/download content
  match current behavior.
- [x] 5.3 Make bootstrap refuse partial activation, reconcile by canonical
  checksum, and become a true no-op on unchanged repeated input.
- [x] 5.4 Add bootstrap progress, normalized error reporting, cleanup of failed
  build state, and a machine-readable health/parity result.
- [x] 5.5 Wire the same command into local reset/seed and the approved release
  pre-deploy path without committing credentials or production artifacts.
- [x] 5.6 Add process-level, local-database, private-Storage, first-run, repeat
  no-op, interrupted-run, and parity tests for the bootstrap command.

## 6. Add Guarded Catalog, Query, Download, and Lifecycle APIs

- [x] 6.1 Add authenticated catalog and entry-query routes using `withRoute`,
  role-filtered metadata, bounded cursor validation, and server-only repositories.
- [x] 6.2 Add authenticated streaming download routes that preserve Country/ROG
  and ROP filters/columns while exporting the complete active matching result.
- [x] 6.3 Add admin candidate refresh/history/findings/diff routes with persisted
  progress and normalized provider failures.
- [x] 6.4 Add admin activate, reject, and rollback routes requiring reasons and
  expected-active IDs, returning explicit validation and `409 Conflict` outcomes.
- [x] 6.5 Convert the existing ISO and ROP refresh routes into tested compatibility
  delegators or remove them in the same cutover after all internal callers move;
  do not retain a second lifecycle implementation.
- [x] 6.6 Convert country alias mutations into focused derive-validate-activate
  operations that preserve duplicate handling and immediate later-read behavior.
- [x] 6.7 Add/update every same-stem route test for anonymous, non-admin, admin,
  method, same-origin, invalid input, provider failure, conflict, success, and
  raw-error redaction behavior.
- [x] 6.8 Extend route-guard and request-security sweeps as needed without moving
  the centralized same-origin policy into individual routes.

## 7. Cut the Resource UI to Persistent Active Versions

- [x] 7.1 Replace the hard-coded Resources page array with the role-filtered
  catalog and show active version/retrieval metadata plus admin-only attention
  states while retaining direct card links.
- [x] 7.2 Update the API Connections Resources card to consume the same catalog
  metadata while preserving its label-only presentation and captured resources.
- [x] 7.3 Change the Country/ROG page and client to query the active persisted
  version, page/search through the server contract, stream downloads, retain the
  current detail fields, and surface an explicit missing-active health error.
- [x] 7.4 Change the ROP page and client to query paged active persisted data,
  preserve flattened rows/details/geography/search, stream complete downloads,
  and avoid sending the full generated payload as initial page props.
- [x] 7.5 Add reusable admin lifecycle UI for persisted progress, candidate
  summary, validation findings, active-version diff, activation/rejection,
  history, and rollback with clear confirmation and error recovery.
- [x] 7.6 Integrate the lifecycle UI into both resource pages with admin-only
  controls and active data remaining visible throughout refresh or failure.
- [x] 7.7 Update country alias editing to show the derived-version operation and
  refresh active version metadata without weakening non-admin read-only behavior.
- [x] 7.8 Add/update same-stem page and component tests for catalog rendering,
  paging/search/download, detail data, role visibility, candidates, invalid
  findings, conflicts, activation, rejection, rollback, aliases, and errors.
- [x] 7.9 Add literal smoke markers and registry interactions for every new
  lifecycle sheet, dialog, menu, tooltip, or popover and run `pnpm run smoke:check`.

## 8. Complete Cutover, Operations, and Documentation

- [x] 8.1 Run local bootstrap on a clean database and prove the persisted active
  resources match the baseline counts, checksums, aliases, representative rows,
  hierarchy, geography, searches, details, and downloads.
- [x] 8.2 Remove runtime reads of generated JSON after initialization, prevent
  silent fallback when active resources are missing, and retain checked-in files
  only as explicit bootstrap/recovery inputs until a later retention change.
- [x] 8.3 Remove the legacy country override runtime read/write path after alias
  fold-in and derived-version tests pass; retain the table as a bootstrap-only
  one-way import until deployed reconciliation proves no environment aliases
  would be deleted by a fresh migration.
- [x] 8.4 Document catalog/version/set concepts, adapter requirements, source and
  artifact ownership, validation/activation/rollback operator workflow, health
  checks, bootstrap/reconciliation, and recovery procedures.
- [x] 8.5 Update current-state architecture, environment variable examples,
  Storage bucket documentation, release sequencing, and local Supabase workflow.
- [x] 8.6 Add an extension guide showing how later external-ID, AX Registry,
  field-mapping, and merge-priority changes add typed adapters without bypassing
  lifecycle, audit, security, or immutable version sets.

## 9. Verify and Close the Change

- [x] 9.1 Run direct unit, route, component, script, migration, and pgTAP tests
  for every touched file with a same-stem test and fix all product, test-gap,
  harness, or environment failures at their source.
- [x] 9.2 Rerun `pnpm run verify:change`, run every listed required command and
  targeted smoke subset, and confirm no required test delta or contract issue is
  missing.
- [x] 9.3 Run `pnpm run verify:change:run` as the terminal candidate-tree gate and
  resolve every failure before handoff.
- [x] 9.4 Stop repo-local Supabase/Docker services started for verification,
  reclaim transient builder cache under repo policy, and confirm persistent data
  was preserved unless an approved clean reset was required.
- [x] 9.5 Verify the implementation against this proposal, design, and every
  scenario with `/opsx:verify`; update inaccurate artifacts rather than accepting
  implementation drift.
- [x] 9.6 Archive the completed OpenSpec change before any ship-local or release
  action, then rerun the planning/spec gates required for the archived tree.
- [x] 9.7 After explicit release approval, run the pre-deploy migration,
  bootstrap/reconciliation, and health/parity checks before application cutover;
  verify the deployed active versions and private-artifact health without
  mutating unrelated production data.
