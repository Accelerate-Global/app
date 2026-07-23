## Context

The shared forming platform resolves one registered engine from a stable source profile, pins source/resource/rule checksums, and publishes only after review. Existing online providers already fetch IMB ArcGIS, Etnopedia MediaWiki, Joshua Project HTTPS, and Google Sheets. The legacy AX Data scripts supply field/type methodology but also contain unstable file selection, positional IDs, silent row drops, and advisory-only duplicates that must not be copied into the authoritative online system.

## Goals / Non-Goals

**Goals:** implement all five Tier 1 source transforms; preserve every structurally readable row; use stable source identity; make blocking ambiguity visible; publish one stable curated dataset per source profile; prove deterministic output with golden fixtures.

**Non-Goals:** AX code allocation, cross-source merge, aggregate products, arbitrary mapping editor, or runtime AX Data/Drive-latest reads.

## Decisions

### Resolve engines from stable source profiles

Code-managed IMB, Etnopedia, and Joshua Project definitions have deployed profile keys. WCD and Accelerate-owned Google Sheets require an administrator to bind an active spreadsheet/tab connection to an approved profile key. Profile binding persists the stable Google spreadsheet ID and `sheetId`; tab renames do not change the profile. A profile can have at most one active connection, and one active connection can have at most one forming profile.

Implemented support and environment configuration remain distinct. A deployed
WCD or Accelerate engine without a binding and stable-key column is unavailable,
not an empty successful source. Joshua Project also fails closed when its API
secret is unavailable. The coordinator and UI report the missing configuration
without inventing a profile, changing legacy writers, or falling back to display
metadata.

### Use shared formation primitives with source contracts

Each source contract declares ordered mappings, semantic types, required/known-excluded fields, provenance code, stable record selector, country policy, ROP policy, duplicate policy, output order, version, and checksum. Shared primitives perform NFKC normalization, exact country alias/ISO lookup, exact ROP hierarchy lookup, typed conversion, finding creation, and deterministic checksums. Source engines add only source-specific extraction and rules.

### Improve unsafe legacy behavior explicitly

- Unresolved or multi-country Etnopedia records are preserved with errors/warnings instead of silently dropped.
- Blank/unmapped ROP3 values remain rows with findings.
- ETNO `peid_list_json` is preserved as source text unless one scalar PEID can be resolved; arrays are not coerced to integers.
- WCD country normalization remains accent/punctuation insensitive but resolves only to an unambiguous pinned alias.
- Duplicate stable row keys and duplicate complete person-country domain keys block publication for every source.
- Position-derived IDs are not considered durable. Code-managed sources use provider identities; Sheet profiles must declare a persisted stable key column or candidate formation is blocked.
- Source-provided AX values are retained only as raw evidence; this stage does not assign or publish authoritative AX identity.

### Source-specific stable record selectors

- IMB: ArcGIS `OBJECTID` under the existing adapter.
- Etnopedia: MediaWiki page ID when present, otherwise normalized canonical page title with a blocking collision check.
- Joshua Project: provider PeopleID3 plus ISO3 when present; a provider record ID may be used when explicitly supplied and unique.
- WCD: administrator-declared stable source key column; no row ordinal fallback.
- Accelerate-owned Sheets: administrator-declared stable source key column per profile; no filename, folder, or row ordinal fallback.

Every output `Dataset_Row_Key` includes the source-profile key plus the normalized stable provider key, while `Dataset_ID` remains the immutable source run ID.

### Engine-managed imports stage snapshots

When a registered engine-managed profile completes an import, the run archives checksummed parsed/raw artifacts but does not call direct dataset import. The run detail offers forming. Unregistered profiles retain current behavior. Source adapters and logs record their versions and redact credentials.

### Publish through one stable target per profile

The source profile owns a stable publication target key and optional current dataset link. Publication uses the atomic prepared-dataset boundary, records immutable publication lineage, and updates the target only after the entire dataset transaction commits. Failed publication leaves the prior dataset untouched and the candidate retryable.

## Risks / Trade-offs

- Existing Sheets may lack stable key columns → block candidate publication and show the exact required configuration; do not mint positional identities.
- Improved row retention can differ from legacy counts → document each difference in the comparison report and require it to match the approved golden contract.
- Source schema changes can break forming → raw ingestion remains archived; schema drift findings identify missing/new fields without corrupting the current dataset.
- Large source builds can outlive one request → use existing background lifecycle and retry/stale-run behavior; no partial artifact is publishable.

## Migration Plan

1. Add source-profile schema, uniqueness constraints, RLS/revokes, code-managed bootstrap, and Google Sheets binding API.
2. Add shared source-contract primitives and engines in ETNO → JP → WCD → AX order; keep IMB parity tests continuously green.
3. Change only engine-managed imports to staging behavior.
4. Build fixture candidates for all profiles, compare counts/columns/findings/checksums, and publish to local stable targets.
5. Deploy, bind production WCD/AX profiles, ingest fresh snapshots, review candidates, then publish each explicitly.

Rollback restores direct behavior only for profiles not yet published through forming. Published curated datasets and all candidate/source artifacts remain versioned and inspectable.

## Open Questions

None. Unresolved rows are preserved; duplicate complete identities block; Sheet profiles require durable key columns; AX identity remains deferred to the registry stage.
