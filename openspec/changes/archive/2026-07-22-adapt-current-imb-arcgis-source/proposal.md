## Why

The repo-owned IMB connection still targets an ArcGIS service that now requires a token, so production ingestion fails before source rows can be archived. IMB publishes a replacement production FeatureServer with a renamed schema, and Accelerate Online needs an explicit, versioned adapter so that current upstream rows continue to satisfy the approved forming contract without losing the untouched raw evidence.

## What Changes

- Point the repo-owned IMB connection at IMB's current public `PROD_pIMBPeople` FeatureServer layer.
- Add a source-specific, versioned adapter that maps the replacement descriptive ArcGIS attributes into the legacy source-field names consumed by IMB forming.
- Preserve the replacement service's raw feature list in the JSON artifact while archiving adapted normalized rows for CSV download and forming.
- Validate the replacement schema before adaptation and fail the run with a normalized error if required identity or forming fields drift again.
- Record the adapter version in run progress so operators can identify which source contract produced an archived run.
- Keep generic ArcGIS parsing and non-IMB connections unchanged.
- Do not publish or replace a workspace dataset as part of ingestion; publication remains an explicit later forming-candidate decision.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `api-connection-runs`: The repo-owned IMB run uses the current public production FeatureServer and a versioned source adapter while preserving raw upstream evidence.
- `imb-dataset-forming`: Eligible IMB source artifacts may contain normalized rows produced by the approved replacement-source adapter without changing the version-1 forming output contract.

## Impact

- Affected source: `src/lib/api-connections/index.ts` and a focused IMB provider adapter under `src/lib/api-connections/providers/`.
- Affected tests: code-managed connection resolution, ArcGIS/IMB parsing, schema-drift rejection, and forming compatibility.
- External system: IMB's public ArcGIS Online `PROD_pIMBPeople` layer (`7620a9ff201a47a3ae09b92466f109de`).
- Data integrity: affected and protected by explicit required-field validation, deterministic mapping, raw-artifact preservation, and regression tests.
- Auth and admin permissions: unchanged; existing admin-only run authorization remains in force.
- Supabase: no schema or policy change.
- Vercel: normal application deployment only; no deployment contract change.
- API contracts: the internal normalized IMB source-row contract is preserved; the upstream ArcGIS field contract is adapted explicitly.
- UI smoke coverage: unchanged because no page or interaction contract changes.
- Non-goals: adding ArcGIS credentials, changing the canonical formed dataset schema, building or publishing a candidate automatically, changing reference-resource matching, or changing generic ArcGIS behavior.
