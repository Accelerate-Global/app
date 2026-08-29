# Reference Resource Operations

Country/ROG and ROP are application-owned reference resources. They are not
live reads from another repository and they do not share a database with AX
Data. AX Online owns the complete package lifecycle: source retrieval,
normalization, typed projections, validation, artifacts, review, activation,
rollback, audit, and immutable resource-set snapshots.

## Concepts and ownership

- A **catalog resource** is a stable definition such as
  `country-territory-codes` or `rop-codes`.
- A **version** is an immutable normalized package plus typed query projections,
  raw/normalized/CSV/validation/diff artifacts, a canonical SHA-256 checksum,
  source retrieval metadata, validation summary, and diff summary.
- A **candidate** is a finalized inactive version. Valid candidates may be
  activated or rejected; invalid packages remain inspectable and cannot be
  activated.
- The **active pointer** selects the version served to normal users. Building a
  candidate never changes it.
- A **resource set** is the checksum-addressed snapshot of every active resource
  after an activation or rollback. Future pipeline runs can bind to the set as a
  reproducibility boundary without loose polymorphic references.
- PostgreSQL owns metadata, projections, pointers, audit, and set membership.
  The private `reference-resource-artifacts` Storage bucket owns immutable large
  artifacts. Server repositories and guarded routes are the only access path.

## Local bootstrap and health

Start local Supabase, apply migrations, seed field sources, reconcile both
resources, and run health checks with:

```bash
pnpm db:start
pnpm db:push
```

`pnpm db:reset` performs the same reconciliation after a clean local reset.
To reconcile without applying migrations, run:

```bash
pnpm reference-resources:bootstrap:local
```

The command imports `src/data/iso-country-codes.generated.json` and
`src/data/rop-codes.generated.json` through the production adapters. Existing
legacy alias rows are folded into the first Country package. Output is JSON and
includes version IDs, checksums, unchanged flags, the current set ID, and health
status. An unchanged repeat must reuse the same versions and perform no
activation.

Healthy means every catalog definition has a valid active pointer, required
artifacts exist, typed projection counts match, and the current resource set
contains the active version. A missing or unhealthy active version is an
explicit error; there is no generated-file runtime fallback.

## Refresh, review, and activation

1. A dataset admin selects **Refresh**. Upstream fetching and batched projection
   writes occur outside the short activation transaction.
2. Review source retrieval metadata, canonical checksum, entry count,
   validation findings, and the added/changed/removed/high-risk diff.
3. Enter an operational reason and activate or reject. Activation requires the
   active version ID that was reviewed; a concurrent pointer change returns
   `409 Conflict` and requires a fresh review.
4. Ordinary readers continue seeing the previous active version during build,
   review, rejection, invalidation, provider failure, or conflict.

Rollback is the same guarded activation transaction pointed at an earlier valid
version. It requires a reason, creates an append-only activation event, and
creates a new immutable resource-set snapshot. It never edits old packages.
If historical package evidence is cold on Samson, ordinary rollback stops with
a stable operator-rehydration requirement. After verified collision-free
rehydration, the same expected-current, checksum, resource-set, and advisory
lock checks run; the cold package remains immutable.

Country alias edits are derive-and-activate operations: the active package is
copied, aliases are normalized and validated, a new version is created, and it
is activated with compare-and-swap. There is no mutable runtime overlay.

## Failure and recovery

- **Upstream failure:** keep the active version, inspect normalized server logs,
  and retry refresh. Raw provider objects are not exposed to clients.
- **Invalid candidate:** inspect findings/diff, correct the source or adapter,
  and build a new candidate. Invalid packages cannot be activated.
- **Interrupted build:** rerun reconciliation/refresh. Canonical checksums make
  completed identical work a no-op; failed uploaded artifacts are cleaned up.
- **Stale activation:** reload history and candidate details, then decide using
  the new active pointer. Do not bypass the compare-and-swap.
- **Unhealthy active package:** stop cutover, run bootstrap health, verify private
  artifacts/projection counts/set membership, then activate a known-good valid
  version or repair the underlying invariant.
- **Disaster recovery:** restore Postgres and the private bucket consistently,
  then run reconciliation. Checked-in generated JSON is an explicit recovery
  seed, not an automatic runtime substitute.

For a linked environment, `pnpm db:push:remote` applies tracked migrations and
then runs the same reconciliation. This is a production-adjacent mutation and
must only be run under explicit release approval.
