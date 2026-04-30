## Why

Admins need the web app to run the working Etnopedia people-group export without leaving the existing API Connections workflow. The current generic API connection runner can fetch one JSON or CSV response, but Etnopedia requires a MediaWiki category listing, batched main-page and talk-page revision fetches, and wikitext parsing to match the proven script output.

## What Changes

- Add an `Etnopedia` preset to the admin API Connections UI that pre-fills the MediaWiki API endpoint, JSON response settings, dataset naming, and PGIC classification.
- Add Etnopedia-specific run execution for `https://en.etnopedia.org/api.php` that lists `Category:Peoples_by_name`, fetches main and talk revisions in batches, and logs progress through the existing async run lifecycle.
- Normalize Etnopedia people-group records into script-compatible CSV columns while preserving structured JSON output in the existing archived raw-response download.
- Preserve existing saved connection CRUD, admin authorization, safe outbound URL checks, run logs, archived output downloads, and dataset create/replace imports.

Non-goals:
- No Google Drive mirroring, Python execution, local filesystem export, or Tier 1 pipeline orchestration in this web-app slice.
- No scheduler, background worker redesign, or automatic environment seed record.
- No change to non-admin dataset viewing permissions, auth roles, same-origin mutation guards, or Supabase private-table posture.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `api-connection-runs`: Add provider-aware Etnopedia setup, MediaWiki export execution, and script-compatible output normalization while preserving existing API connection safety and import semantics.

## Impact

- Affects admin UI behavior in `src/components/dashboard/api-connections-client.tsx`.
- Affects API connection execution in `src/lib/api-connections.ts`.
- Adds Etnopedia parsing/orchestration helpers under `src/lib/etnopedia-api.ts` with focused tests.
- Affects API connection tests under `src/lib/api-connections.test.ts`, `src/lib/etnopedia-api.test.ts`, and `src/components/dashboard/api-connections-client.test.tsx`.
- Affects admin-only API connection contracts and data integrity of imported rows; it does not change auth roles, same-origin mutation guards, Vercel deployment behavior, database schema, or UI smoke route coverage.
