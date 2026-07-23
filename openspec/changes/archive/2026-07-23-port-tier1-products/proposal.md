## Why

Identity-enriched Tier 1 sources still need reproducible replacement for the legacy “latest file” merges and Aggregate 1 products. The online system must bind exact publications, registry revision, resources, and rules so field winners and derived outputs can be reviewed, reproduced, and rolled back.

## What Changes

- Add immutable Tier 1 release sets for exact AX, ETNO, IMB, JP, and WCD publications.
- Add reviewable merge/aggregate pipeline runs, artifacts, findings, publication anchors, and stable targets.
- Port PGIC merge, specific-PG merge, field priorities/provenance, workers needed, PGAC Aggregate 1, Self-Engaged, Watchlist, Baseline UUPG, Hotspots, and South Asia.
- Replace independent latest selection with explicit parent publication bindings and out-of-date reporting.
- Require explicit administrator publication and atomic dataset replacement for every named product.

## Capabilities

### New Capabilities

- `pipeline-release-sets`: Immutable exact input/publication/resource/registry/rule selections.
- `tier1-merge-products`: Deterministic PGIC and specific-PG merges with provenance and workers.
- `aggregate1-products`: PGAC Aggregate 1 and named derived publications.

### Modified Capabilities

- `ax-identity-registry`: Release sets bind one exact registry revision and identity publication per source.

## Impact

- Private pipeline/release/publication tables and RLS/security tests.
- Pure merge/aggregate/filter engines with golden and permutation tests.
- Guarded pipeline APIs, shared history/review UI, stable datasets, and operator documentation.
- No runtime AX Data or Drive-latest dependency and no new service.
