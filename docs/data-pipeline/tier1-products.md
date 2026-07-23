# Tier 1 and Aggregate 1 product operations

The Pipeline Products admin page turns immutable, identity-enriched source publications into reviewed Tier 1 and Aggregate 1 dataset products. Every build retains the exact source publication IDs, checksums, resource set, AX registry revision, priority rules, definition version, findings, artifacts, and output checksum used to create it.

## Required run order

1. Ingest and form AX, Etnopedia, IMB, Joshua Project, and World Christian Database sources.
2. Publish each formed source through the AX Identity Registry. Sequential
   publication means the five identity publications can originate at different
   registry revisions. Select the final revision produced after the last source;
   it must be at least as new as every origin revision and still contain every
   exact binding used by every selected publication.
3. Open `/admin/pipeline-products` and finalize a Tier 1 release. Select exactly one identity publication for `ax`, `etno`, `imb`, `jp`, and `wcd`. Finalization is atomic: an incomplete, stale, checksum-mismatched, or revision-incompatible selection creates no usable release.
4. Build both Tier 1 products from that exact release:
   - Tier 1 canonical PGIC merge
   - Tier 1 specific people-group merge
5. Review each candidate's findings, lineage, comparison report, and downloadable rows before publishing it.
6. Build PGAC Aggregate 1 from one exact published Tier 1 specific-PG publication, then review and publish it.
7. Build the named Aggregate 1 derivatives from their required exact parents:
   - Self-Engaged from PGAC Aggregate 1
   - Watchlist from PGAC Aggregate 1
   - Baseline UUPG from Watchlist
   - Hotspots from Baseline UUPG
   - South Asia from PGAC Aggregate 1

The page filters parent choices to the publication target required by each definition. It never substitutes the latest dataset rows for a selected immutable publication.

The named orchestration definitions are `tier1-release` for already published
identity inputs and `tier1-full` for the full five-source forming, identity,
release, Tier 1, and Aggregate 1 path. Neither is schedule-eligible; each pauses
at every review gate and needs explicit administrator decisions.

Definition checksums cover the executable semantic contract, not only display
metadata. The contract includes grouping keys and aliases, normalization,
priority and release binding keys, workers/percentage thresholds, derived
filter thresholds, hotspot count/ranking, and the exact South Asia scope
version/checksum. Composite orchestration checksums include every child product
definition checksum, so a rule change makes both new product candidates and
the affected full-flow launch definition observably out of date.

## Review and publication

A candidate with errors is `invalid` and cannot publish. A valid candidate with warnings requires an explicit warning acknowledgement and a publication reason. Equal-priority conflicting values are blocking errors. Missing priority rows use the pinned JP, IMB, AX, ETNO, WCD fallback and produce reviewable warnings.

Approved Tier 1 and Aggregate 1 products are workspace-visible final datasets,
so they appear in the normal dataset list. This visibility is part of each
definition checksum and is preserved when the stable dataset is replaced;
identity-stage datasets remain private intermediates.

Publication rechecks the complete reviewed evidence rather than trusting only
the output rows. The immutable manifest must match the append-only artifact
records, every stored body must match its checksum and byte size, and the rows,
canonical columns, CSV, findings, and semantic lineage must still agree. Any
tamper or incomplete artifact stops publication before the stable target is
claimed.

Each candidate exposes:

- formed rows in JSON and CSV;
- validation findings;
- exact input lineage;
- a comparison with the retained publication at the same stable target, when one exists.

Publication rechecks the stored row count and output checksum, verifies that the active code definition still matches the reviewed version, and requires the stable target to remain at the exact publication that was current when the candidate was built. The target check is serialized and repeated inside the database transaction, so two candidates reviewed against the same prior target cannot both replace it. Dataset replacement, publication history, publication rows, input lineage, and run status commit in that transaction. A failure before commit rolls back database changes, removes the newly uploaded dataset object, and returns the candidate to `valid` so it can be retried without creating a false publication. A committed object is never removed merely because the follow-up detail refresh fails.

## Stable targets and out-of-date state

Each named definition owns one stable publication target. The first approved publication creates the target dataset; later approved publications replace that same dataset while dataset version history remains available as read-only audit evidence. Previous pipeline publications and their archived rows remain immutable.

A candidate or published child becomes **Out of date** when one of its exact parent targets publishes a newer version. The existing result is not mutated. Rebuild from the newly selected release or parent, compare the output, and publish only after review.

## Retry and rollback

- Build failure: correct the source/resource/definition problem and build again. Failed run evidence remains for diagnosis.
- Rejected candidate: record the rejection reason and build a new candidate; rejected history is immutable.
- Publication failure: retry the still-valid candidate after the operational cause is fixed. An interrupted `publishing` lease is recovered automatically after its bounded timeout; the attempt token prevents the interrupted worker from committing after recovery. Retrying after the publication already committed returns that same published run without replacing the dataset or creating duplicate history.
- Bad published output: use the target-aware Pipeline Products rollback operation to select the exact retained publication, the current publication observed during review, and a reason. The service verifies the retained publication belongs to the same target, revalidates its immutable rows, CSV, row count, and checksum, restores those exact rows to the stable dataset, and appends a new auditable rollback run/publication.

For the current admin API, send `POST
/api/admin/pipeline-products/targets/{publicationTargetKey}/rollback` with:

```json
{
  "publicationId": "85000000-0000-4000-8000-000000000041",
  "expectedCurrentPublicationId": "85000000-0000-4000-8000-000000000042",
  "reason": "Why this exact publication is being restored"
}
```

The expected-current guard is repeated inside the serialized target transaction.
If the stable target advanced after review, rollback stops without overwriting
the newer publication and removes its prepared storage object. Generic dataset
replacement or row-batch upload, status/visibility changes, backing-dataset
assignment, and upload-history revert are rejected for pipeline-managed
datasets. Previous publications, artifacts, lineage, and
dataset version evidence remain read-only and are never deleted or rewritten.

## Optional Google Sheet export

The durable system of record is the published dataset and immutable pipeline publication. If a team needs a Google Sheet, download the approved CSV and export it after publication. A Sheet export is a downstream convenience copy; it must not become an input substitute or publication authority.
