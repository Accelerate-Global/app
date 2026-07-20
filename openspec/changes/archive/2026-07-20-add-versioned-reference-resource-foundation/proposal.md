## Why

Accelerate Online already exposes useful Country/ROG and ROP resources, but the
catalog is hard-coded, the canonical payloads are checked-in generated files,
and a source refresh only replaces data in the current browser session. The
forming pipeline cannot safely normalize or aggregate sources until reference
data has durable versions, validation evidence, explicit activation, and an
immutable way for future runs to identify exactly which resource versions they
used.

## What Changes

- Add a persistent reference-resource catalog with immutable versions,
  source/retrieval metadata, checksums, typed entries, validation findings, and
  private Storage artifacts.
- Add an admin lifecycle that builds a candidate, validates it, previews the
  change from the active version, activates it explicitly, rejects it safely,
  and rolls back by reactivating a known valid version. Failed candidates never
  replace the active resource.
- Add versioned resource sets so a coherent collection of resource versions can
  be pinned now and bound immutably to pipeline runs when that pipeline exists.
- Bootstrap Country/ROG and ROP from the checked-in generated resources into
  the new foundation without changing their domain schemas or trusted upstream
  inputs.
- Drive the Resources catalog and Country/ROG and ROP pages from the active
  persisted versions; keep authenticated search, inspection, and download while
  replacing session-only refresh behavior with persistent candidates.
- Give authenticated users read access to active resource data and metadata;
  restrict candidate/history details and all lifecycle mutations to dataset
  admins, with actor, timestamp, reason, and previous-version audit data.
- Add database constraints, least-privilege access, pagination, concurrency
  protection, observability, deterministic bootstrap tooling, and complete unit,
  route, database-security, migration, and UI smoke coverage.
- Document the resource boundary and operator workflow so future ISO3, ROG3,
  ROP, external-identifier, field-mapping, and merge-priority resources extend
  one platform rather than creating parallel storage conventions.

### Non-goals

- This change does not migrate AX Data ingestion, forming, merge, aggregation,
  publication, or scheduling logic.
- This change does not add PEID/PGID/PeopleID crosswalks, the AX Identifier
  Registry, source field mappings, or merge-priority configuration; those are
  subsequent resource families built on this foundation.
- This change does not connect the AX Data repository or its database to
  Accelerate Online.
- This change does not allow arbitrary end-user resource uploads or make
  reference artifacts public.
- This change does not alter the existing centralized same-origin guard,
  workspace-role authority, or Vercel deployment model.

## Capabilities

### New Capabilities

- `versioned-reference-resources`: Persistent catalog, immutable versions and
  typed entries, private artifacts, validation/diff evidence, admin activation
  and rollback, auditable lifecycle events, and coherent versioned resource
  sets.

### Modified Capabilities

- `reference-resources`: Replace hard-coded discovery metadata with the
  persistent active-resource catalog and expose lifecycle status appropriate to
  the signed-in role.
- `iso-country-code-resource`: Load the active persisted Country/ROG version and
  replace session-only refresh with validated candidate creation and explicit
  activation while preserving alternate-name behavior.
- `rop-code-resource`: Load the active persisted ROP version and replace
  session-only refresh with validated candidate creation and explicit
  activation.

## Impact

- **Supabase and data integrity:** New private Postgres tables, constraints,
  indexes, transactional lifecycle functions, private Storage bucket, RLS and
  privilege tests, plus an idempotent bootstrap importer for the existing
  generated JSON resources.
- **Application and API contracts:** New resource repository/service modules and
  admin lifecycle endpoints; existing resource refresh responses change from a
  transient full payload to persistent candidate/version results.
- **Auth and admin permissions:** Workspace roles remain sourced from
  `auth.users.raw_app_meta_data.workspace_role`; active resources remain
  authenticated-readable, while mutations and non-active lifecycle data are
  admin-only through the existing route guard.
- **UI:** `/dashboard/resources`, `/dashboard/country-codes`, and
  `/dashboard/rop-codes` gain persisted version metadata and admin lifecycle
  surfaces while retaining their established routes and core lookup behavior.
- **Verification:** Existing same-stem tests must change with their production
  files; migrations require pgTAP/RLS coverage; changed pages and new sheets or
  dialogs require route-registry and smoke-surface coverage.
- **Deployment:** No Vercel topology change. Deployment gains a deterministic,
  idempotent resource bootstrap/reconciliation step and a private Storage bucket
  whose artifacts are accessed only by server-side code.
- **Brownfield evidence:** The current hard-coded catalog is in
  `src/app/dashboard/resources/page.tsx`; generated-file loaders are in
  `src/lib/iso-country-codes.ts` and `src/lib/rop-codes.ts`; session replacement
  lives in their dashboard clients; Storage conventions are in
  `src/lib/dataset-storage.ts`; current behavior is specified by
  `openspec/specs/reference-resources`, `iso-country-code-resource`, and
  `rop-code-resource`.
