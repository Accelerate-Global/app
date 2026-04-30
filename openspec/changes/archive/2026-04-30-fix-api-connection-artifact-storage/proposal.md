## Why

IMB People Groups test runs can fetch and parse the ArcGIS response successfully, but then fail while archiving JSON run artifacts because those artifacts are uploaded to the CSV-oriented `datasets` Storage bucket. The bucket is restricted to CSV MIME types, so API connection output storage needs its own private JSON artifact bucket.

## What Changes

- Store API connection run JSON artifacts in a dedicated private Supabase Storage bucket.
- Upload archived `rows.json` and `raw-response.json` artifacts with bare `application/json` content type.
- Preserve current JSON and CSV download HTTP behavior for admins.
- Read existing archived output paths from the new artifact bucket first and the legacy `datasets` bucket second.
- Add a Supabase migration that creates or updates the private artifact bucket with JSON-only MIME restrictions and a size limit large enough for current ArcGIS output.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `api-connection-runs`: Successful API connection runs archive JSON output artifacts in a dedicated private Storage bucket while preserving legacy output download compatibility.

## Impact

- Affects Supabase Storage configuration and migration state.
- Affects API connection run artifact upload/download behavior in `src/lib/api-connections.ts` and Storage helper behavior in `src/lib/dataset-storage.ts`.
- Does not change admin permissions, HTTP response shapes, dataset CSV upload behavior, UI smoke coverage, or Vercel deployment behavior.
