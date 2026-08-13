# Tier 2 partner and product operations

Tier 2 is a review-gated pipeline. Ingestion, forming, identity reconciliation, release building, and publication are separate durable steps. A successful build never advances a published dataset by itself.

## Onboard a partner profile

1. In **Datasets → Add dataset**, connect the exact Google spreadsheet and tab.
2. On the dataset-details step, select **Tier 2 — Engagement dataset**, choose the active dataset owner, name the distinct feed, and select the stable row-key, tracking-ID, and any available country/ROP evidence columns from the reviewed headers.
3. Confirm the final review. The app creates the Google Sheets connection and exact Tier 2 profile together, using the currently active `engagement-mappings` version and checksum. If either record cannot be created, neither is retained.
4. Select the profile before launching its flow. The launch snapshot pins that profile and connection instead of resolving a generic “Tier 2 partner” at execution time.

One owner can have several distinct engagement feeds. For example, Final-58 and Final-Sudan are separate Tier 2 profiles and Sheet-tab identities under the same active Accelerate owner. This does not make either feed the **Accelerate-owned people groups** source; that is a separate Tier 1 source profile selected independently during onboarding.

The Tier 2 administrator page remains the place to inspect profiles and operate their lifecycle. Once a profile has produced a forming run, its stable identity fields cannot change; onboard a new profile for a different source identity.

Schedules are profile-specific. Run one successful manual canary for the exact profile, then enable that profile’s interval from the Tier 2 admin page. Enabling or disabling one partner never changes another partner’s schedule or canary evidence.

The canary must match the deployed `tier2-partner` definition version and
checksum and must have pinned the same active profile ID. A changed definition
or different profile invalidates that evidence. Schedules are disabled by
default and scheduled runs still stop at forming and identity review gates;
they never acknowledge warnings or publish automatically.

## Maintain contract resources

Validate and activate complete AX Online catalog versions before the first
forming run:

- `jp-peopleid3`
- `peid`
- `engagement-mappings`

Create new versions through the Tier 2 resource administration flow. It
validates schema, duplicate keys, active entries, and pinned Country/ROP
cross-references before activation. Finalized versions are immutable;
activation and rollback only move the audited active-version pointer. The
workflow accepts complete current packages and never reads an AX Data path or
manifest.

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

Tier 2 review uses only current formed rows, current crosswalk resources, AX
Online identity evidence, and exact release inputs. The admin application does
not accept or store AX Data rows for comparison or matching.
