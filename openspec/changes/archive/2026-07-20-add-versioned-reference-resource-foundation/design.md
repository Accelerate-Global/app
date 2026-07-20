## Context

Country/ROG and ROP already have typed fetch, parse, normalization, validation,
search, detail, and CSV behavior. Their canonical application payloads are
currently `src/data/iso-country-codes.generated.json` and
`src/data/rop-codes.generated.json`; the resource catalog is a constant in
`src/app/dashboard/resources/page.tsx`; and each refresh endpoint returns a
full payload that its client stores only in React state. Country alternate names
are the exception: they persist in a private override table and are applied over
the generated file at read/refresh time.

That shape is useful for lookup but cannot support reproducible forming. A
future source run must be able to say, for example, "formed with Country/ROG
version 18 and ROP version 7," and those versions must remain inspectable after
new resources are activated. Resource refresh also needs a safe review boundary:
external changes become candidates first, and only a valid, explicitly accepted
candidate becomes the default.

Constraints:

- Keep the existing Next.js, Supabase Postgres/Storage, Drizzle, route-guard,
  workspace-role, and Vercel boundaries.
- Keep trusted-source parsing and domain validation in the existing TypeScript
  modules; do not copy old AX Data implementation quality into the new runtime.
- Preserve the current authenticated lookup routes and domain vocabulary.
- Keep provider artifacts private and provider errors normalized.
- ROP is large enough that version history cannot be implemented as repeated
  20+ MB page props or single giant database transactions.
- SQL migrations, local pgTAP/RLS tests, OpenSpec, same-stem tests, and UI smoke
  coverage are required repo contracts.

Stakeholders are dataset admins who curate and activate resources, signed-in
users who search and download active resources, and future pipeline runs that
need immutable resource identities.

## Goals / Non-Goals

**Goals:**

- Establish one durable catalog and lifecycle for all reference-resource kinds.
- Make normalized version payloads immutable, content-addressed, validated, and
  auditable.
- Make activation and rollback safe, atomic, and concurrency-aware.
- Preserve strong Country/ROG and ROP schemas and indexed join paths.
- Provide immutable resource-set snapshots for future pipeline-run pinning.
- Migrate existing resources without data loss or a production availability gap.
- Replace browser-session refresh with persistent candidates and role-aware
  review surfaces.
- Make local and deployed bootstrap/reconciliation deterministic and idempotent.

**Non-Goals:**

- Build the ingest, forming, merge, aggregation, publication, or scheduler
  runtime.
- Implement external people-ID crosswalks, AX codes, field-mapping resources,
  or merge priority in this change.
- Generalize every resource entry into an untyped JSON table.
- Permit arbitrary uploads or direct browser access to private artifacts.
- Link AX Data runtime state, databases, or deployments to Accelerate Online.
- Change authentication, role ownership, or deployment topology.

## Decisions

### 1. Use a generic lifecycle with typed resource projections

The shared private schema will contain:

- `reference_resources`: stable key, kind, label, description, route, current
  active version pointer, timestamps, and catalog ordering.
- `reference_resource_versions`: monotonic per-resource version number,
  lifecycle state (`building`, `valid`, `invalid`, or `rejected`), schema
  version, normalized checksum, source and retrieval metadata, counts, artifact
  manifest, validation/diff summary, actor, and timestamps.
- `reference_resource_validation_findings`: severity, rule code, stable entry
  key/field, message, and structured details.
- `reference_resource_activation_events`: append-only activation/rollback audit
  with previous version, selected version, actor, reason, and time.
- `reference_resource_sets` and `reference_resource_set_members`: immutable
  snapshots of the complete active-version selection after each activation.

Country/ROG uses a typed `country_reference_entries` projection with constrained
and indexed ISO, GENC, FIPS, ROG3, classification, name, status, and alias
columns. ROP uses normalized typed term, people, and geography projections keyed
by version, with parent links and indexes for ROP1/2/2.5/3, ISO3, ROG, PeopleID3,
status, and join issues. UI DTOs reconstruct the current resource shapes from
these projections.

This hybrid is preferred over a single generic JSONB entry table because forming
needs constrained codes and efficient joins. It is preferred over unrelated
per-resource version systems because lifecycle, audit, activation, artifact,
and future run-pinning behavior must remain uniform.

Every foreign key receives an index. Stable keys are unique within a version.
Checks constrain states, counts, nonblank keys, and supported resource kinds.
Timestamps use `timestamptz`; primary keys use UUIDs, while resource version
numbers are monotonic display identifiers rather than identities. Composite and
partial indexes serve `(resource_id, version_number)`, candidate/history reads,
active pointers, stable entry keys, and the dominant code/search paths.

### 2. Treat a version as an immutable package, not merely a database row

A version package contains:

1. a raw-source manifest and source artifacts where licensing and source shape
   permit retention;
2. canonical normalized JSON and optional CSV artifacts;
3. typed relational projections used for search and forming;
4. validation findings and a deterministic diff against the active version;
5. source metadata, schema version, row counts, and a SHA-256 checksum of
   canonical normalized content.

Artifacts live in a dedicated private `reference-resource-artifacts` Storage
bucket under resource/version-scoped paths. Only server-side code signs or reads
objects. The normalized checksum is computed from a canonical serialization so
identical content is detectable across refreshes.

A build may write only while its version is `building`. Batched inserts avoid a
single long ROP transaction. Finalization takes a short transaction that checks
expected counts/checksum/artifacts and changes the state to `valid` or `invalid`.
Database triggers reject payload, source, artifact, and projection mutation
after finalization. Validation records and lifecycle audit remain append-only.

This is preferred over storing only Storage JSON because lookup/forming queries
need indexes and constraints. It is preferred over storing only rows because raw
evidence, portable normalized snapshots, and validation reports are operationally
important.

### 3. Separate building, validation, and activation

Admin refresh performs this flow:

```text
trusted sources -> parse/normalize -> building version + private artifacts
                -> typed projections -> validation + active-version diff
                -> valid candidate -> explicit admin activate
```

An invalid build remains inactive with its findings available to admins. A valid
candidate may be rejected with a reason. Activation accepts the expected current
version ID, obtains a transaction-scoped advisory lock for the resource, verifies
the candidate is still valid and complete, swaps the active pointer, appends an
activation event, and creates a new immutable resource-set snapshot in one short
transaction. A stale expected pointer returns a conflict rather than overwriting
another admin's decision.

Rollback is not destructive and does not rewrite content: it reactivates a prior
valid version through the same transaction and records a `rollback` event. The
previous active version remains valid and inspectable.

This is preferred over auto-activating all refreshes because upstream changes
can be structurally valid but operationally surprising. It is preferred over a
mutable `active` status on versions because a single catalog pointer plus events
preserves historical validity and makes rollback straightforward.

### 4. Preserve immediate curated alias behavior through derived versions

Country alternate names affect search, downloads, and later forming, so an
override outside the version would make a pinned version nondeterministic. An
admin alias add/delete therefore derives a new Country/ROG version from the
active version, applies the edit, runs focused validation, and atomically
activates it with an audit reason. This specialized operation preserves the
current immediate user outcome while ensuring every visible alias set belongs to
an immutable version.

Existing override rows are folded into the bootstrap Country/ROG version. The
runtime read/write path is removed in this implementation, so the table becomes
a bootstrap-only one-way import and no longer affects active reads. Physical
table removal requires a later post-deployment migration after every environment
has reconciled; dropping it in the initial migration would delete production
aliases before the bootstrap process could import them. Keeping a mutable
runtime overlay was rejected because it would undermine reproducibility.

### 5. Expose active data broadly and lifecycle controls narrowly

All new tables are in `private`, have RLS enabled, and revoke privileges from
`public`, `anon`, and `authenticated`. Browser code does not query them directly.
Authenticated resource pages read active data through server-only repository
functions. Admin lifecycle routes use `withRoute({ access: "admin" })`; same-origin
protection remains centralized in `src/proxy.ts`; and provider errors are logged
through `src/lib/error-logging.ts` without returning raw provider objects.

Non-admin users see the active version number, retrieval time, and source
summary. Admins additionally see candidates, validation/diff results, version
history, activation/rejection/rollback controls, and actor audit data. Lifecycle
mutations require a concise reason for activation, rejection, and rollback.

This follows the existing private API-connection pattern and avoids expanding
Supabase Data API grants. Runtime authority continues to come from
`raw_app_meta_data.workspace_role` via `getCurrentIdentity`.

### 6. Query resource entries on the server with stable cursors

Country/ROG may still fit in a single response, but both resource families use a
common server query contract: resource key, active or admin-selected version,
search/filter, stable sort, limit, and opaque cursor. ROP results are paginated
by a deterministic composite cursor rather than offset. Search is performed over
indexed normalized text/code columns, and signed-in CSV download streams the
complete matching result rather than only the currently loaded browser page.

This prevents the current 20+ MB ROP payload from being duplicated for every
page view and establishes the query shape later forming tools can reuse. Offset
pagination was rejected because concurrent activation/history browsing and deep
pages make it slower and less stable.

### 7. Make resource sets the future pipeline boundary

Each successful activation creates a new `reference_resource_set` containing one
version for every active resource. The set and its members are immutable and
content-addressed. The application exposes a server-only resolver for the
current set and a resolver by set ID.

The future pipeline-run change will add a real foreign key from each run to a
resource set; this change deliberately does not add a polymorphic
`consumer_type/consumer_id` binding without referential integrity. This provides
the pinning primitive now without pretending a pipeline-run model already
exists.

### 8. Bootstrap checked-in resources without embedding large payloads in SQL

SQL migrations create schema, policies, functions/triggers, indexes, and the
private bucket, then register the two stable catalog definitions. A tested
idempotent TypeScript command reads the checked-in generated JSON, applies the
current Country alternate-name overrides, validates through the same production
builders, uploads artifacts, inserts typed rows in batches, finalizes, activates,
and creates the first resource set.

The importer compares canonical checksums and is a no-op when equivalent active
versions exist. It refuses partial initialization and reports per-resource
health. Local reset/seed and the release workflow invoke the same command with
environment-appropriate credentials; the migration itself does not embed the
large ROP payload.

Deployment sequencing is migration -> bootstrap/reconcile -> health/parity
check -> application cutover. During implementation only, a measured
compatibility loader can read generated JSON when the new catalog tables do not
yet exist. The final cutover path does not silently fall back after the catalog
is initialized; missing active versions are surfaced as an operational error.

### 9. Keep resource-family adapters explicit

The common service owns version lifecycle, artifacts, audit, sets, paging
contracts, and permissions. A registry of typed adapters owns resource-specific
fetch, parse, validate, diff classification, projection writes, DTO reads, and
CSV mapping. The first adapters wrap the current ISO/Country and ROP domain
functions rather than rewriting their trusted-source logic.

Adding PEID/PGID/PeopleID or another future family requires a new typed adapter,
typed projection/migration where needed, validation rules, and catalog
registration; it does not create another lifecycle or Storage convention.

## Data Flow

```text
Admin POST refresh
  -> existing route guard + same-origin guard
  -> resource adapter fetches trusted upstreams
  -> canonical domain builder normalizes and validates source shape
  -> lifecycle service creates building version and uploads raw manifest
  -> adapter batch-writes typed projections
  -> lifecycle service writes normalized artifact, findings, and diff
  -> short finalization transaction marks valid/invalid
  -> admin reviews candidate
  -> short locked activation transaction swaps pointer + audit + resource set
  -> authenticated readers query the new active version
```

## API and UI Boundary

- `GET /api/reference-resources` returns role-filtered catalog metadata.
- `GET /api/reference-resources/[resourceKey]/entries` returns cursor-paged active
  entries; admins may request a specific version.
- `GET /api/reference-resources/[resourceKey]/download` streams matching CSV.
- Admin endpoints under the same resource namespace create refresh candidates,
  read history/findings/diffs, activate, reject, and rollback.
- Existing ISO and ROP refresh URLs may remain as compatibility delegators for
  one release, but their response contract becomes candidate metadata and tests
  must make that transition explicit.
- The existing three pages retain their routes and smoke-page markers. New
  lifecycle dialogs/sheets expose literal smoke trigger/surface/ready markers.

Exact endpoint filenames can be selected during implementation, but all routes
must use the shared service and existing guard rather than duplicate lifecycle
logic.

## Verification Impact

- Unit tests: canonical serialization/checksums, state transitions, diffs,
  adapter validation, pagination cursors, alias-derived versions, error
  normalization, and bootstrap idempotency/parity.
- Route tests: identity/role gating, candidate results, conflict behavior,
  activation/rejection/rollback, download, and no raw provider leakage.
- Database tests: constraints, foreign-key indexes, private privileges, RLS,
  immutable triggers, atomic activation/resource sets, stale-pointer conflicts,
  rollback, and concurrent candidate protection.
- Migration tests: local reset, bootstrap from both generated resources, exact
  count/checksum parity, repeat no-op, and legacy override one-way fold-in.
- UI tests: catalog from persistence, role-filtered metadata, candidate review,
  validation/diff states, activation confirmation, history/rollback, search,
  details, download, and error recovery.
- Smoke: existing routes plus every new dialog/sheet/menu surface; run
  `smoke:check` and the targeted subset selected by `verify:change`.
- Terminal: rerun the planning gate, every required command it lists, and
  `pnpm run verify:change:run`; local Supabase is expected for DB and UI lanes
  and must be stopped/cleaned afterward under repo policy.

## Risks / Trade-offs

- **[Large ROP imports exceed request/runtime limits]** -> Build in a server job
  service boundary with batched writes, bounded upstream requests, progress
  records, and short finalization/activation transactions; do not perform one
  monolithic Vercel transaction.
- **[A Vercel request may end before refresh finishes]** -> Make build state
  resumable/idempotent and keep orchestration separable from the HTTP trigger.
  The first implementation may execute synchronously only if measured duration
  is within the configured runtime; the persisted state machine remains the
  contract.
- **[Generic lifecycle becomes an untyped dumping ground]** -> Require a
  registered adapter and schema version for activation; use typed projections
  for join-critical families.
- **[Storage and projections diverge]** -> Finalize only after checksum, counts,
  and artifact existence agree; health checks re-derive and compare the package.
- **[Two admins activate conflicting candidates]** -> Advisory transaction lock
  plus expected-active compare-and-swap returns `409 Conflict` to the stale
  request.
- **[Bootstrap creates duplicate versions]** -> Canonical checksum uniqueness
  and idempotent reconciliation make repeats no-ops.
- **[Country alias behavior surprises users]** -> Derive and activate a focused
  immutable version atomically, preserving immediate visibility and audit.
- **[Server-side search changes current client semantics]** -> Contract tests
  cover every current search field and downloads use the full matching query.
- **[Private DB access hides RLS mistakes]** -> Revoke Data API grants, test
  privileges/RLS in pgTAP, and expose all reads/mutations only through guarded
  server boundaries.
- **[Initial scope expands into the entire pipeline]** -> Stop at resource
  lifecycle, typed Country/ROP migration, resource sets, and UI/operations; use
  separate OpenSpec changes for external IDs, AX registry, and the IMB vertical
  slice.

## Migration Plan

1. Add schema, constraints, indexes, immutability/activation functions, private
   bucket, catalog definitions, Drizzle mappings, and database tests.
2. Add generic lifecycle/repository/artifact/query services and the typed
   Country/ROG and ROP adapters with focused tests.
3. Add the deterministic bootstrap/reconcile command; reset local Supabase,
   import both generated resources and existing overrides, and prove exact
   counts/checksums plus repeat no-op behavior.
4. Add read APIs and cut the catalog/resource pages to persisted active versions;
   prove current search/detail/download parity and ROP paging.
5. Replace transient refresh with candidate build, validation/diff review,
   activation/rejection, history, and rollback; convert alias mutations to
   derived version activation.
6. Add resource-set resolution, health/observability, docs, smoke surfaces, and
   release bootstrap integration.
7. Run full required verification, deploy migration and bootstrap before the app
   cutover, verify active-version parity and private-artifact health, and confirm
   transitional runtime loaders are retired. Drop the legacy override table in
   a later migration only after deployed fold-in parity is recorded.

Rollback keeps schema and versions in place. If the application cutover fails,
reactivate the previously known valid version or temporarily redeploy the prior
application build; no payload deletion is required. A bad resource activation is
recovered through the audited rollback operation. Storage/object deletion and
version pruning are explicitly deferred until a separately specified retention
policy exists.

## Open Questions

No blocking architectural question remains for the foundation. Retention limits,
scheduled refresh cadence, source-specific approval thresholds, and the first
pipeline-run binding policy belong to later operational or pipeline changes and
must not weaken immutable versions or explicit activation.
