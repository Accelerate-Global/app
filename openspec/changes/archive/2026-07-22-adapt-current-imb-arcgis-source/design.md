## Context

The IMB code-managed connection is stored in `src/lib/api-connections/index.ts`, but an already-materialized database row can retain the retired `pIMBpeoplePublic` URL indefinitely. That service now returns ArcGIS error 499 (`Token Required`) inside an HTTP 200 response. IMB's public replacement, `PROD_pIMBPeople`, is accessible without credentials and contains the same domain data under descriptive attribute names. The current forming engine intentionally consumes the legacy IMB source-field contract and binds archived row/raw artifact checksums before any publication.

The replacement service is larger than a single response page, so the existing stable ArcGIS pagination must remain in use. The replacement also returns Web Mercator geometry unless the query requests a spatial reference; the existing fetcher already requests `outSR=4326`, while the adapter will prefer the replacement's explicit `Lat` and `Long` attributes for legacy `Latitude` and `Longitude` fields.

## Goals / Non-Goals

**Goals:**

- Restore token-free production ingestion from IMB's current production layer.
- Preserve the version-1 forming source contract and all downstream candidate rules.
- Make the schema translation deterministic, versioned, checksummed, and inspectable.
- Preserve the untouched replacement-service features in the raw JSON artifact.
- Reject unexpected removal of identity or required forming attributes before archiving a misleading successful run.
- Keep the stored target dataset association and generic ArcGIS behavior unchanged.

**Non-Goals:**

- Adding ArcGIS authentication or attempting to regain access to the retired layer.
- Automatically creating, validating, or publishing a forming candidate after ingestion.
- Revising the canonical formed output schema or reference-resource rules.
- Reconstructing discontinued optional fields such as the old population-range label when the replacement source does not publish an equivalent.
- Applying IMB-specific renaming to other ArcGIS connections.

## Decisions

### Use the public `PROD_pIMBPeople` layer as the code-owned source

The code-managed definition will target layer 0 of item `7620a9ff201a47a3ae09b92466f109de`. Its owner (`imbGIS`), production title, pipeline description, public query capability, stable `OBJECTID`, and current rows make it the best available replacement. Retrying the retired URL with an anonymous token or silently using a less authoritative English view would leave the connection fragile.

### Treat code-managed execution fields as authoritative at run time

When a built-in connection already has a materialized database record, execution will overlay code-owned request fields from the current definition while preserving mutable persisted state such as the target dataset association. This ensures a deployment can replace a retired endpoint without erasing publication linkage or requiring a one-off database edit.

### Adapt normalized IMB features, not the raw upstream response

The generic ArcGIS fetcher will continue to collect the exact feature list. For the IMB connection only, parsing will map replacement attributes into the legacy source columns before normalized rows are archived. The raw JSON artifact therefore remains evidence of what IMB returned, while the normalized rows remain compatible with the established forming contract. Generic ArcGIS runs keep their current all-attribute flattening.

### Use an explicit mapping table with a version and checksum

The adapter will define the legacy column order and replacement attribute for each field. Direct mappings cover identity, country, affinity, engagement, language, religion, ROP hierarchy, resource availability, and coordinates. Fields no longer supplied by IMB remain present and blank rather than being guessed. The adapter metadata is included in the normalized rows artifact and logged on the run, so the source artifact checksum binds a candidate to the exact adapter.

### Fail only on missing structural fields

The adapter will require `OBJECTID`, `PEID`, `Name`, `ISOAlpha3`, `CountryName`, and `ROP3Code` to exist in the fetched schema. Missing optional values remain blank and are handled by existing forming findings. This distinguishes an upstream contract break from legitimate per-row missing data.

## Risks / Trade-offs

- [IMB changes descriptive field names again] → The adapter fails with a normalized schema error instead of archiving a false success; raw active datasets and prior runs remain unchanged.
- [Some old optional concepts no longer exist] → The adapter emits explicit blank legacy columns and does not fabricate values; the raw artifact retains all replacement attributes for future contract revisions.
- [Materialized connection metadata is stale] → Run-time overlay makes code-owned request fields authoritative while preserving persisted target linkage; a later cleanup may update display persistence without affecting this fix.
- [Replacement data values differ from the retired snapshot] → The adapter maps meanings, not historical values. Current IMB values are preserved and later forming validation exposes country/ROP/value warnings.
- [Large full-layer fetch exceeds runtime constraints] → Existing deterministic page fetching and response limits remain unchanged; production ingestion is verified after deployment.

## Migration Plan

1. Deploy the updated code-managed URL, run-time definition overlay, and adapter.
2. Run a production IMB ingestion and verify it archives the current row count with adapter metadata.
3. Leave the current published dataset and candidate state untouched.
4. Roll back the application deployment if the replacement source proves incompatible; prior artifacts and datasets remain available because no database migration or automatic publication occurs.

## Open Questions

None. The user approved the recommended replacement-source adapter and explicitly authorized production ingestion verification.
