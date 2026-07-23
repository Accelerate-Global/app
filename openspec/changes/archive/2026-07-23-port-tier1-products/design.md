## Context

Legacy Tier 1 merges choose independently latest source files, then select values by a priority sheet and publish several downstream copies. Aggregate 1 groups specific people-country rows by ROP3 and derives filters whose behavior depends on exact provenance. Online identity publications and registry revisions provide stable inputs, while the generic candidate/artifact/publish lifecycle provides review and immutable retained-publication rollback evidence.

## Goals / Non-Goals

**Goals:** exact release inputs; deterministic field winners/provenance; both Tier 1 merge variants; workers; exact Aggregate 1 math; named derived products; explicit publication; out-of-date tracking.

**Non-Goals:** Tier 2 sources/products, arbitrary DAG editor, silent latest selection, automatic publish, or Sheets as authority.

## Decisions

### Release sets bind publication anchors

A finalized release set contains one publication for each required input key, one resource set, one registry revision, and one rule version/checksum. Finalization verifies member checksums and completeness and stores a canonical checksum sorted by input key. Members are immutable and use `pipeline_publications`, not mutable current dataset rows or delayed archive-version IDs.

The five source publications may originate from sequential registry revisions.
The selected final revision is compatible only when it is not older than each
member's origin revision and its full snapshot contains every exact binding ID
used by every member. Missing or superseded bindings block finalization; equal
origin revision IDs are not required.

### Use one generic post-forming pipeline lifecycle

`pipeline_runs` handles identity, merge, and aggregate stages with exact inputs, rule bindings, findings, artifact records, lifecycle decisions, and publication. Named code definitions declare stage, required inputs, version/checksum, output classification/target, and pure build function. No definition writes a dataset directly.

Before publish, the run manifest must exactly match the append-only artifact
rows. Every artifact body is checked against its recorded checksum and size,
and rows, canonical columns, CSV, findings, and semantic lineage are
deterministically revalidated before the stable target can be claimed.

The definition checksum is computed from a canonical semantic contract as well
as its lifecycle metadata. That contract enumerates executable grouping keys,
field aliases, normalization, thresholds, scopes, source precedence, and
external binding keys. Composite orchestration definitions include these child
checksums as semantic dependencies, so changing one rule invalidates both the
product definition and every flow that contains it.

Final Tier 1 and Aggregate 1 definitions declare workspace visibility as part
of that checksummed behavior, so approved products appear in the normal
dataset list and retain that visibility on replacement. Identity-stage
datasets remain private intermediates.

### Preserve approved Tier 1 merge behavior safely

PGIC merge groups exact canonical PGIC and selects each field by pinned active priority. Missing configuration uses JP → IMB → AX → ETNO → WCD and emits a warning per fallback field. Equal-ranked nonblank conflicts are blocking. Specific-PG merge groups normalized ROP3+ISO3; missing either key remains a unique unmerged row with a finding. Every selected field retains `src__<field>` provenance and ordered contributing sources.

Workers is `ceil(population / 50000)`; missing/invalid is blank plus finding. Negative populations are invalid rather than producing negative staffing.

### Port Aggregate 1 math exactly where safe

PGAC groups specific-PG output by nonblank ROP3, sums valid population, chooses primary country from highest population with stable source-order tie-break, retains sorted alternatives, and population-weights Christian percentages using total group population denominator. Decimal output truncates to two places. Other fields use pinned provenance-aware priority. `Joint` is true only when all five sources contribute.

Derived products are separate definitions bound to exact parent publications. Threshold/provenance behavior is captured by golden boundary tests. South Asia uses an explicit versioned country-scope contract. Hotspots retains exactly ten countries by population descending then name.

### Parents mark children out of date, never mutate them

A later parent publication marks existing child publications out of date by comparison query. Rebuild and publish remain explicit; current child datasets are not automatically replaced.

Each candidate captures the stable target's current publication ID at build
time. Normal publication compares that expected value again inside the
serialized database transaction. An exact rollback names both the retained
publication to restore and the reviewed current publication. It revalidates the
retained immutable rows, CSV, checksums, and target ownership before replacing
the stable dataset; it then repeats the expected-current check under the same
target advisory lock and appends a new published run and publication.
If another operation advances the target, the stale operation fails without
replacing the newer publication. Generic dataset replacement or row-batch
upload, status, visibility, classification or tag mutation, deletion,
backing-dataset assignment, and upload-history revert are rejected for any
dataset owned by a pipeline publication. Database triggers enforce the same
boundary for direct Supabase DML against datasets, rows, versions, and version
rows. Publication receives a direct-server-only transaction capability; it is
not a persistent setting and cannot be granted to PostgREST roles.

Current and archived dataset storage paths are claimed in a permanent
path-and-dataset ledger under a path-scoped transaction lock. Migration
backfills every exact historical ownership pair, including legitimate archived
aliases, as grandfathered claims. A recorded owner may reuse its own historical
path, but an unrecorded dataset cannot join any claimed path. A one-row
owner-set gate atomically arbitrates every path in addition to the pairwise
audit ledger and path lock, so concurrent first claims have one winner at every
supported transaction isolation level. A separate one-row identity ledger
atomically tombstones each dataset identifier. Claim triggers run after
successful row writes, so skipped insert/upsert arms cannot create ghost
tombstones; dataset-ID immutability is a separate side-effect-free
before-update guard. Claims cannot move between dataset identities, survive
dataset deletion, and prevent a deleted UUID from being recreated to revive an
old object. Dataset identifiers are immutable after insert, so an existing
record cannot assume a deleted identity even if it also selects that identity's
tombstoned path. Current dataset paths remain independently unique. Generic
deletion checks every remaining dataset, archived version, and committed
pipeline publication reference before removing an object from storage.

## Risks / Trade-offs

- Legacy priority gaps become visible warnings → improves governance while retaining approved fallback.
- Aggregate edge behavior is non-obvious → fixed golden/boundary tests and provenance artifacts are mandatory.
- Large transactions can be heavy → build artifacts outside publication; publish complete prepared rows atomically in bounded inserts.

## Migration Plan

1. Add release/pipeline schema/security and definition registry.
2. Port/test PGIC and specific-PG merge plus workers.
3. Port/test Aggregate 1 and named products in dependency order.
4. Build side-by-side sanitized and approved retained comparisons; explain every difference.
5. Publish stable targets explicitly, retain legacy outputs read-only, then disable their writers after approval.

Rollback restores one exact retained publication through its target-aware
Pipeline Products operation. The old publication is never mutated or made
current in place: the operation restores its verified rows to the stable
dataset and appends a new auditable rollback run/publication that records the
actor, reason, source publication, and expected prior target. Release sets,
runs, artifacts, publications, and read-only dataset version evidence remain
preserved.

## Open Questions

None. Missing priority uses the documented fallback with warnings; negative population is invalid; child rebuild/publication is manual.
