## Why

Admins need the web app to run the working IMB People Groups ArcGIS pull without leaving the app or losing the current API connection audit/output flow. The existing generic API connection runner can fetch one JSON or CSV response, but the IMB source requires ArcGIS FeatureServer pagination and `attributes` plus `geometry_*` row flattening to match the proven script behavior.

## What Changes

- Add first-class support for ArcGIS FeatureServer feature query pagination in admin API connections configured as JSON `features` responses.
- Fetch all ArcGIS pages using `resultRecordCount`, `resultOffset`, and stable object ID ordering when available.
- Normalize ArcGIS feature rows by flattening `attributes` and appending `geometry_*` columns while preserving first-seen column order.
- Add an admin UI preset that creates a usable `IMB (People Groups)` API connection pointed at the public IMB ArcGIS layer.
- Preserve existing saved connection CRUD, secret-header handling, safe outbound URL checks, async run logs, archived output downloads, and dataset create/replace imports.

Non-goals:
- No Google Drive mirroring in the web app; run outputs continue through the existing Supabase-backed API connection artifacts.
- No Python execution path, scheduler, or external worker in this slice.
- No broad source registry redesign or changes to non-admin dataset viewing permissions.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `api-connection-runs`: Admin API connections can run ArcGIS FeatureServer feature queries, including all-page pagination and IMB-compatible feature flattening.

## Impact

- Affects admin UI on `src/components/dashboard/api-connections-client.tsx` and the existing smoke-tracked `/dashboard/api-connections` page.
- Affects API connection domain behavior in `src/lib/api-connections.ts` and shared API types in `src/lib/api-types.ts`.
- Affects existing admin API contracts under `src/app/api/admin/api-connections/**` through accepted payload values, while same-origin mutation guards remain centralized in `src/proxy.ts`.
- Affects Supabase-backed run output artifacts and optional dataset imports; no schema migration is required.
