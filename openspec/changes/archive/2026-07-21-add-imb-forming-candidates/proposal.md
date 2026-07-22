## Why

IMB API ingestion currently archives and imports lightly normalized rows without applying the resource-bound forming methodology proven in AX Data. Accelerate Online needs an application-owned, reproducible forming step that preserves raw evidence, binds every result to exact reference versions, exposes unresolved identifiers instead of hiding them, and requires admin review before formed data becomes a workspace dataset.

## What Changes

- Add an IMB-only forming lifecycle that consumes one successful archived IMB ingestion run and binds it to the current immutable reference-resource set plus a versioned IMB field contract and transformation version.
- Produce immutable formed-row, lineage-manifest, and validation artifacts with deterministic checksums and structured row/field findings.
- Apply the approved rules for field projection, written-scripture restoration, ISO3/country resolution, exact ROP3 hierarchy resolution, type conversion, stable row identity, duplicate detection, and unresolved-row preservation.
- Add admin APIs and connection-detail controls to build, inspect, reject, and explicitly publish a valid IMB candidate; warning-bearing candidates require acknowledgement and never auto-publish.
- Change IMB import runs to preserve archived source output without immediately creating a workspace dataset. Existing non-IMB API connection import behavior remains unchanged.
- Correct ArcGIS paging so the first retained page uses the same stable object-ID ordering as every subsequent page.
- Add private Supabase tables, least-privilege protections, artifact paths, indexes, and database security coverage for forming runs and findings.
- **Non-goals:** cross-source merging, aggregation, fuzzy identifier matching, AX-code allocation, generalized forming for Joshua Project/Etnopedia/Google Sheets, and an editable field-mapping administration UI.

## Capabilities

### New Capabilities

- `imb-dataset-forming`: Reproducible IMB candidate formation, findings, review, rejection, and explicit publication from an immutable ingestion output and resource set.

### Modified Capabilities

- `api-connection-runs`: Preserve IMB import outputs as unformed source artifacts until candidate publication and guarantee stable ArcGIS object-ID pagination from the first retained page.

## Impact

- **Data integrity:** Adds deterministic source/resource/transform bindings, row-preservation checks, content checksums, explicit findings, and publication gating.
- **Supabase:** Adds private control tables and indexes through a committed migration; tables remain inaccessible to browser roles and are served only through guarded server routes. Existing private API-run Storage remains the artifact boundary.
- **APIs:** Adds admin-only forming candidate lifecycle endpoints beneath the existing API connection/run routes.
- **UI:** Extends the existing connection detail and run-detail sheet with IMB candidate state, findings, and publish/reject actions; existing route smoke markers remain in place and new interactive surfaces receive smoke markers.
- **Auth/admin permissions:** Uses the existing dataset-admin route guard; no workspace-role semantics change.
- **Vercel:** Background candidate generation continues through the existing Next.js `after` execution pattern; no hosting configuration change is expected.
- **Brownfield seams:** Reuses archived run outputs in `src/lib/api-connections/index.ts`, resource-set resolution in `src/lib/reference-resources/index.ts`, dataset publication in `src/lib/datasets.ts`, and the candidate/artifact patterns documented in `docs/operations/reference-resources.md`.
