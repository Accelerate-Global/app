## Why

Engagement-partner Sheets and Aggregate 2 still depend on mutable selection and legacy ledger/files. They need the same immutable ingestion → forming → identity → release → candidate → publish lifecycle as Tier 1, with exact JP/IMB supplemental versions and visible duplicate-identity conflicts.

## What Changes

- Add administrator-managed engagement-partner source profiles and deterministic Tier 2 forming contracts.
- Pin JP PeopleID3, PEID, Country, ROP, field, and tracking-ID mappings per candidate.
- Reuse the shared AX registry and stable profile/row bindings.
- Finalize exact multi-partner Tier 2 release sets and build a provenance-preserving union with blocking duplicate canonical identities.
- Publish Aggregate 2 Combined Release from exact Tier 2, IMB, and JP publication inputs while retaining versioned provenance-preserving union semantics.

## Capabilities

### New Capabilities

- `tier2-source-forming`: Engagement-partner profile forming, crosswalks, identity, and publication.
- `tier2-release-products`: Exact partner release union and Aggregate 2 Combined Release with provenance/conflict review.

### Modified Capabilities

- `source-profile-connections`: Approved partner Sheet profiles carry stable keys and typed tracking-ID configuration.
- `ax-identity-registry`: Tier 2 reuses the shared namespace and source bindings.
- `pipeline-release-sets`: Tier 2 releases bind exact partner/supplemental publications.

## Impact

- Engagement source contracts/engines, profile persistence/APIs/UI, shared registry use, release/pipeline definitions, stable datasets, tests/docs.
- No second ledger, no latest-file selection, no new paid service.
