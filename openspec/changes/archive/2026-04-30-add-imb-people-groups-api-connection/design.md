## Context

`src/lib/api-connections.ts` currently supports saved admin API requests with JSON or CSV response parsing, async run records, archived outputs, and optional dataset imports. The IMB People Groups source is an ArcGIS FeatureServer query endpoint that requires paging with `resultRecordCount` and `resultOffset`; its usable rows live in each feature's `attributes` object, with map coordinates in `geometry`. The supplied Python script proves the required source behavior and output shape, but running Python and mirroring to Drive are outside the app's current API connection architecture.

## Goals / Non-Goals

**Goals:**
- Allow admins to create and run an `IMB (People Groups)` saved connection from the existing API Connections page.
- Add ArcGIS FeatureServer pagination to the existing async run flow without adding a new worker, scheduler, or source-specific route.
- Preserve the script's raw row semantics: all attribute keys are retained, geometry keys become `geometry_*` columns, and columns follow first-seen order.
- Keep existing safe outbound URL checks, redirect limits, request timeout pattern, response-size protection, run logs, output downloads, and dataset create/replace imports.

**Non-Goals:**
- Drive uploads, local filesystem snapshots, Python execution, and Tier 1 pipeline orchestration.
- Scheduled refreshes or automatic creation of the connection in every environment.
- Changing access control for non-admin users or moving API connection data out of private Supabase tables.

## Decisions

1. **Represent ArcGIS with the existing JSON profile shape.** The IMB preset uses `responseFormat="json"` and `responseDataPath="features"`. During execution, FeatureServer query URLs with that shape use the ArcGIS paged fetch and flattening path. This keeps connection CRUD, validation, storage, and DB constraints unchanged. Alternative considered: adding an `arcgis-features` response format, but that requires a Supabase schema migration and remote migration push for a behavior that can fit the current profile contract.

2. **Page during execution, not parsing.** For matching ArcGIS FeatureServer query URLs, execution will call the configured endpoint repeatedly with `where=1=1`, `outFields=*`, `outSR=4326`, `f=json`, `resultRecordCount`, and `resultOffset`. The first page determines `objectIdFieldName`; subsequent pages include `orderByFields` for stable paging. Alternative considered: storing query parameters in the URL only, but that leaves pagination incomplete and couples admin input too tightly to ArcGIS syntax.

3. **Use an ArcGIS-specific response cap.** Generic API connections keep the existing 2 MB body cap. ArcGIS pages and their cumulative raw feature list use a larger 64 MB cap because the public IMB layer has more than 12,000 features and a single 2,000-record page can exceed 2 MB. This preserves response-size protection while allowing the requested source to complete. Alternative considered: reducing page size until every page fits the generic cap, but the full archived raw output would still exceed 2 MB.

4. **Keep output artifacts compatible.** Successful ArcGIS runs will persist normalized rows/columns the same way JSON and CSV runs do. The raw response artifact will contain the raw feature list used for normalization, matching the script's JSON snapshot shape closely enough for downstream inspection.

5. **Add a client-side preset instead of environment seeding.** The API Connections page will expose an `IMB (People Groups)` preset that fills the current form with the public endpoint, JSON `features` response path, create-dataset mode, `imb-people-groups.csv`, and PGIC classification. Admins still choose when to save, test, or import. Alternative considered: a migration seed row, but private profile ownership and environment-specific admin IDs make seeded rows brittle.

6. **Avoid DB changes.** The existing `json` response format and private API connection tables are sufficient, so no migration, RLS, or privilege changes are needed.

## Risks / Trade-offs

- **ArcGIS source size can exceed a bounded response cap** -> Enforce the larger ArcGIS cap cumulatively across page bodies and fail the run with the existing `API response is too large.` error when exceeded.
- **Long pagination can exceed function runtime** -> Reuse the existing request timeout per page and page-size default, and log page progress so failed runs are diagnosable.
- **Admins may edit preset details into invalid ArcGIS settings** -> Validation keeps the URL HTTPS-only and response format explicit; parser errors produce failed runs instead of partial imports.
- **FeatureServer detection depends on URL shape and response path** -> Limit special handling to `/FeatureServer/<layer>/query` URLs configured with `responseDataPath="features"` so unrelated JSON APIs keep existing behavior.
