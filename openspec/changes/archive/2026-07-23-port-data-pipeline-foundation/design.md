## Context

AX Online already archives API ingestion evidence, owns immutable Country/ROG and ROP resource packages, and gives IMB a reviewable forming candidate before dataset publication. The implementation is nevertheless IMB-shaped: eligibility is hard-coded to one connection, database JSON types and services use IMB names, resource bindings are fixed to Country and ROP, and successful non-IMB imports still publish source rows directly.

The legacy AX Data repository contains the remaining source-forming, identity, merge, and aggregate methodology, but it is not suitable as a runtime dependency. The migration must characterize that behavior with sanitized fixtures, then reimplement approved rules behind AX Online's existing admin, private-storage, versioning, and deployment boundaries. This foundation change covers Waves 0–2 of `plans/002-port-all-data-pipelines.md`; later OpenSpec changes will add source engines, AX identity, merge, and aggregate products on the shared contracts created here.

## Goals / Non-Goals

**Goals:**

- Introduce one source-agnostic forming lifecycle with a typed engine registry and deterministic result envelope.
- Preserve existing IMB candidate output, lifecycle, artifacts, routes, publication, and historical records.
- Add immutable engine, contract, resource, and artifact-schema bindings to every new candidate.
- Let each engine declare the exact resource keys it requires and reject a build before execution when those bindings are unavailable or unhealthy.
- Characterize every legacy flow and rule status in checked-in documentation and sanitized golden fixtures so later ports have a stable comparison target.
- Add source-alias, JP PeopleID3, PEID, Tier 1 priority, engagement-mapping, and code-contract resources in a form that later engines can pin without reading mutable external files.
- Keep browser roles away from private pipeline tables and artifacts; all mutations remain administrator-only and same-origin guarded.

**Non-Goals:**

- Port non-IMB source transforms, allocate AX identities, merge sources, or publish aggregates in this change.
- Build a user-configurable DAG or rule editor.
- Connect AX Online at runtime to the AX Data checkout, Google Drive “latest” files, or unversioned spreadsheets.
- Rewrite existing IMB artifacts or destructively rename current database columns.

## Decisions

### Add a generic lifecycle beside backward-compatible IMB exports

Create `src/lib/dataset-forming/` as the authoritative lifecycle and contract layer. It defines generic statuses, findings, validation summaries, artifacts, resource bindings, engine declarations, build context, and result envelopes. The current IMB engine remains source-specific and is registered through a thin adapter. Existing `src/lib/imb-forming/**` imports and HTTP routes remain compatible while delegating lifecycle policy and metadata to the shared layer.

This avoids a flag-day rewrite. Existing IMB records remain readable because the migration is additive, existing columns stay populated, and the generic reader derives legacy defaults when new metadata is absent. New writes include both the legacy fixed columns required by current constraints and the generic engine/resource metadata until a later cleanup migration is proven safe.

### Use code-defined forming engines and immutable declarations

Each engine has a stable key, display name, supported source-profile keys, version, checksum, artifact schema version, ordered resource requirements, and a pure `form` implementation. Registry lookup is explicit and fails closed for an unknown or ambiguous source profile. The engine checksum covers the declaration and source-contract version; implementation changes that alter output must change the version or checksum fixture.

The lifecycle owns eligibility, background execution, status transitions, persistence, private artifacts, rejection, publication, and dataset versioning. Engines own source fields, stable row keys, conversions, source-specific validation, and required resources. Engines cannot publish datasets directly.

### Store generic metadata additively on existing forming records

Add `engine_key`, `engine_version`, `engine_checksum`, `artifact_schema_version`, and `resource_bindings` to `private.dataset_forming_runs`. Backfill existing rows as IMB version 1 from their current transformation and Country/ROP columns. New constraints require nonblank engine bindings and a canonical JSON array of resource bindings for new records.

Keep `resource_set_id`, fixed Country/ROP IDs in derived response data, and the current lifecycle values for compatibility. Do not create a second candidate table. Existing indexes remain, while active-build uniqueness expands conceptually to source run, resource set, and engine checksum. Existing finalized record immutability, RLS, browser-role revokes, and private artifact storage remain authoritative.

### Bind resources from engine declarations before running transforms

An engine declares required resource keys with expected kind/schema and whether the binding is code-defined or catalog-backed. At build start, the lifecycle resolves one immutable current resource set, verifies every required member is valid and checksummed, and persists the ordered bindings. Code-defined contracts use explicit version/checksum entries in the same binding envelope but do not pretend to be mutable catalog resources.

Country/ROG and ROP continue to come from the existing catalog. New tabular resources use typed adapters, immutable versions, validation, activation, and resource-set membership. Source field contracts remain code-defined unless a reviewed external update source exists. A resource refresh or contract change never mutates an existing candidate or publication.

The retained source-alias, JP PeopleID3, PEID, Tier 1 priority, and engagement
mapping resources are imported only as complete snapshots from a checked-in
manifest of exact AX Data relative paths, SHA-256 checksums, and retrieval
timestamps. The importer validates all five files and their cross-resource
relationships before activating any candidate, stores the full typed payload
and lineage on immutable versions, and advances active pointers with
expected-current checks. It never searches for a newest file. Sanitized
packages remain local/test bootstrap evidence and are not production seeds.

### Characterize legacy behavior without production data

Add `docs/data-pipeline/flow-inventory.md`, a decision log, sanitized fixtures under `tests/fixtures/pipelines/`, and a deterministic comparison harness. Every rule is labeled `confirmed by code`, `confirmed by fixture`, `documented only`, `conflicting`, or `unused`. Fixtures cover ordinary rows, absent identifiers, aliases, unknown geography, missing ROP3, duplicates, invalid types, schema drift, and cross-source precedence.

The harness runs only against checked-in fixtures. It must not read local AX Data paths, Drive, provider APIs, Supabase production data, or secrets. Later engines will promote approved expectations into direct golden tests before publication is enabled.

### Keep publication explicit and compatible

An ingestion snapshot may advertise a registered forming engine, but successful ingestion does not imply a current publishable dataset for an engine-managed source. Candidate build, review, warning acknowledgement, rejection, and publication remain separate states. The existing dataset create/replace/version behavior is reused only after a valid candidate is explicitly published.

During this foundation change, IMB is the only registered runtime engine. Non-IMB imports retain their existing behavior until their source-specific OpenSpec change registers an engine and updates that connection's import policy. This prevents accidental changes to current production flows.

### Reuse one run-detail surface

The current run-detail sheet renders the generic candidate response and engine label. It retains the literal smoke markers and half-viewport desktop behavior. Long IDs and checksums remain truncated/copyable and cannot overflow. No new page, workflow builder, or source-specific candidate UI is introduced.

## Risks / Trade-offs

- **Dual legacy/generic metadata can drift** → One adapter writes both from a single resolved binding and tests assert the IMB legacy projection equals the generic metadata.
- **A broad resource catalog can become maintenance-heavy** → Add only resources required by approved legacy flows, with typed schemas and checked-in seed/update evidence; code-defined contracts remain code-defined.
- **Legacy rules may conflict with current product intent** → Mark conflicts in the decision log and keep later engine publication disabled until the rule is approved and represented by a golden fixture.
- **Background execution can stop on Vercel** → Preserve observable building/failed records, idempotent retries, immutable completed artifacts, and no false published state.
- **A resource activates during a build** → Resolve and persist the complete set before execution; later activation does not affect the candidate.
- **Additive columns temporarily retain IMB-specific fields** → Accept short-term duplication to protect historical data and remove obsolete fields only in a later migration after production backfill verification.

## Migration Plan

1. Add characterization documentation, fixtures, and the offline comparison command.
2. Add generic TypeScript contracts, registry, resource resolver, policy, storage façade, and the IMB adapter with no output changes.
3. Create an additive Supabase migration for engine and resource-binding metadata, backfill existing IMB rows, preserve RLS/revokes, and add constraint/security coverage.
4. Switch forming reads/writes and run-detail hydration to the generic response while retaining existing IMB route URLs and compatibility exports.
5. Import the five complete checksum-pinned retained tabular snapshots through
   the immutable resource lifecycle; verify full-payload persistence,
   all-resource set health, and impact queries. Keep sanitized packages limited
   to local/test bootstrap.
6. Compare an IMB golden fixture before/after the adapter and verify identical columns, rows, findings, and checksum.
7. Deploy application and migration together. Verify existing IMB candidates remain inspectable and a new IMB candidate builds and publishes through the generic lifecycle.

Rollback is an application rollback that continues reading the original columns; additive metadata and artifacts remain preserved. New resource definitions can remain inactive. No published dataset or historical candidate is deleted or rewritten.

## Open Questions

None for the foundation. Later source and identity changes must resolve any entries still labeled `conflicting` in the characterization decision log before enabling publication for the affected flow.
