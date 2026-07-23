# Tier 2 partner and product operations

Tier 2 is a review-gated pipeline. Ingestion, forming, identity reconciliation, release building, and publication are separate durable steps. A successful build never advances a published dataset by itself.

## Onboard a partner profile

1. Create one active Google Sheets API connection for the partner’s exact spreadsheet and tab.
2. In **Admin → Tier 2 Products**, create a profile with a unique `profileKey` and `partnerKey`, the connection ID, exact spreadsheet ID and numeric sheet ID, a stable row-key column, and one tracking discriminator: `peopleid3`, `peid`, `rop3`, or `provider-native`.
3. Record the active `engagement-mappings` numeric version (without the UI's `v` prefix) and its exact content checksum as the profile contract version/checksum. Forming fails closed unless both values match the exact engagement-mappings resource selected for that run. Once a profile has produced a forming run, its stable identity fields cannot change. Create a new profile for a different source identity.
4. Select the profile before launching its flow. The launch snapshot pins that profile and connection instead of resolving a generic “Tier 2 partner” at execution time.

Schedules are profile-specific. Run one successful manual canary for the exact profile, then enable that profile’s interval from the Tier 2 admin page. Enabling or disabling one partner never changes another partner’s schedule or canary evidence.

The canary must match the deployed `tier2-partner` definition version and
checksum and must have pinned the same active profile ID. A changed definition
or different profile invalidates that evidence. Schedules are disabled by
default and scheduled runs still stop at forming and identity review gates;
they never acknowledge warnings or publish automatically.

## Import contract resources

Import and activate the exact checksummed catalog snapshots before the first
forming run:

- `jp-peopleid3`
- `peid`
- `engagement-mappings`

Use `pnpm run pipeline-resources:import:local` for the local database or
`pnpm run pipeline-resources:import:remote` for the linked environment. The
shared operation imports these alongside source aliases and Tier 1 merge
priorities from a fixed path/checksum manifest. It validates schema, duplicate
keys, active entries, and pinned Country/ROP cross-references before any of the
five candidates activates. Finalized versions are immutable; activation and
rollback only move the audited active-version pointer. A production environment
intentionally fails closed until reviewed full payloads are imported—sanitized
fixture packages are local bootstrap/test data only.

## Review a partner flow

The forming engine retains every source row and its original country/ROP evidence. Missing or ambiguous tracking IDs, invalid crosswalks, and conflicting country/ROP evidence produce findings. Blocking errors prevent publication without deleting the candidate or its downloadable artifacts. Each candidate permanently records the exact Country and ROP version IDs/checksums plus the base AX registry revision ID/checksum captured at build time. Later resource activation or registry publication never changes identity inputs for an existing candidate.

Publishing an approved forming candidate creates one immutable private publication. The candidate also records which formed-source publication was current when it was built. Publication takes a per-profile target lock and repeats that expected-current comparison in the commit transaction; if another candidate publishes first, rebuild and review instead of retrying the stale candidate. Every attempt records an opaque owner token, start time, and its own blob path. Commit accepts only that owner token. An interrupted attempt older than 15 minutes is returned to `valid` and its orphan blob is removed before another attempt claims it. Identity reconciliation must consume the exact forming publication and the candidate’s pinned identity inputs. The shared AX registry then reuses or reserves source bindings and produces another reviewable candidate. Approving the identity candidate commits one new registry revision and identity publication atomically.

## Build the Tier 2 release

Tier 2 requires exactly one identity publication for every active partner profile, ordered by profile key. The chosen final AX registry revision may be newer than an individual partner publication when it contains every exact identity binding used by that publication. This supports sequential partner publication without weakening reproducibility.

The candidate is a deterministic, provenance-preserving union. Duplicate canonical PGIC values are blocking conflicts, but all conflicting rows remain in private evidence. Correct the source/profile/crosswalk or registry binding, publish new partner evidence, and build a new release; never edit a finalized release.

## Build Aggregate 2 Combined Release

The approved consumer name is **Aggregate 2 Combined Release** and its stable internal key is `aggregate2`. It combines exactly three immutable publications in order: the freshly published Tier 2 Combined Release, IMB, and JP. It never independently selects “latest” inputs during execution. Newer supplemental or Tier 2 publications make an existing candidate visibly out of date without changing it.

Use `tier2-release` after every configured partner has a reviewed identity
publication. That definition finalizes the exact partner release, publishes the
Tier 2 union, and then builds/publishes Aggregate 2 through separate review
gates. A supported but unconfigured profile is not release membership and is
not silently invented by the definition.

## Publish and roll back

Publication first authenticates the immutable column contract and top-level artifact manifest checksum, then verifies all four required artifact records and bodies (`rows-json`, `rows-csv`, `findings-json`, and `lineage-json`), exact stored rows, row count, output checksum, current definition checksum, warning acknowledgement, and the expected current target publication. Any missing or tampered evidence fails before the stable dataset changes. The database then advances the stable final dataset and publication pointer in one transaction. Tier 2 and Aggregate 2 final datasets are workspace-visible by definition; intermediate formed partner sources remain private. The two products have separate compare-and-swap target pointers.

Rollback selects a prior publication that belongs to the same target, reconstructs its exact rows and CSV from immutable publication evidence, and replaces the stable dataset through normal dataset-version history in the same transaction that advances the audited target. It preserves the stable target's existing workspace visibility instead of applying an intermediate-source default. The incident dataset version remains archived, while lineage, findings, releases, and publication evidence remain immutable. A stale expected-current value aborts the dataset replacement and target update together.

## Legacy comparison and cutover

Before freezing legacy writers, build the exact Tier 2 or Aggregate 2 candidate in the Tier 2 administrator page. In **Legacy side-by-side comparison**, select that completed candidate and upload the final read-only AX Data rows JSON artifact (`columns` plus `rows`) with the review reason. The application stores one immutable checksummed `comparison-json` artifact for the candidate. Review the retained/dropped/added/conflicting totals and explanations in the page, then download the full retained report to inspect every identity's exact legacy and candidate rows. Resolve every unexplained difference before publication, then disable the corresponding legacy writer. Preserve legacy Sheets/files and the downloaded comparison report read-only for audit; do not continue dual writes.

The sanitized characterization fixture remains in `tests/fixtures/tier2-products/comparison.json` for regression testing only; it is not production cutover evidence. Product behavior and operator decisions are covered by `src/lib/tier2-products/*.test.ts`, `supabase/tests/database/005_tier2_products.test.sql`, and the Tier 2 admin smoke route.
