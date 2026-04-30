## Context

API connection runs archive two JSON artifacts after parsing: normalized rows and redacted raw output. Those artifacts currently use the same Supabase Storage bucket as uploaded CSV datasets. The live `datasets` bucket is CSV-restricted, so large JSON API outputs can fetch and parse successfully but fail when the runner uploads archived output artifacts.

## Goals / Non-Goals

**Goals:**
- Isolate API connection JSON artifacts in a private Storage bucket with JSON-only MIME restrictions.
- Preserve existing admin-only download API behavior and response content types.
- Preserve compatibility with any previously stored output objects in the legacy `datasets` bucket.
- Keep CSV dataset upload behavior unchanged.

**Non-Goals:**
- Do not expose Storage policies for authenticated direct browser access to API artifacts.
- Do not change the `api_connection_run_outputs` table shape.
- Do not change dataset import behavior or API connection UI behavior.

## Decisions

- Use a dedicated `api-connection-artifacts` bucket by default, with `SUPABASE_API_CONNECTION_ARTIFACT_BUCKET` as an optional environment override. This keeps JSON artifacts separate from CSV dataset uploads and avoids widening the user-facing dataset bucket.
- Store only object paths in existing output rows and choose the artifact bucket at read time. Downloads try the artifact bucket first, then the legacy `datasets` bucket, preserving old rows without a schema migration.
- Upload archived artifacts with bare `application/json`. Download responses keep `application/json; charset=utf-8` because that is the public HTTP contract for admin downloads, not the Storage upload allowlist value.
- Create or update the Storage bucket via SQL migration. The bucket remains private, permits only `application/json`, and uses a 128 MiB file limit to cover current ArcGIS output artifacts.

## Risks / Trade-offs

- Existing legacy artifacts could exist only in `datasets` Storage. The fallback read path mitigates this without changing saved metadata.
- The artifact bucket will need to exist in every Supabase environment before API connection runs can archive output. The migration creates or updates it as part of normal database migration flow.
- Service-role artifact access remains centralized in server code. This is intentionally less flexible than direct browser Storage reads, but keeps artifact authorization behind existing admin-only routes.
