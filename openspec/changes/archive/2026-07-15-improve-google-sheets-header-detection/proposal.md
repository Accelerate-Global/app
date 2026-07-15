## Why

Google Sheets imports currently treat the first non-empty row as the column header, so report titles, instructions, and numeric reference rows become dataset columns and inflate the imported row count. Background imports also leave the connection detail page with stale queued messaging and no **Open dataset** action until the administrator reloads the page.

## What Changes

- Detect likely Google Sheets header rows from a bounded preview instead of assuming the first non-empty row is the header.
- Show the recommended one-based header row, confidence, resulting columns, and first data rows during connection setup.
- Let administrators override the recommendation with any previewed row; a confirmed manual selection always wins.
- Support an explicit one-to-three-row combined-header mode for genuine multi-row headers while leaving single-row selection as the default.
- Persist the chosen header configuration and fingerprint in the Google Sheets provider configuration.
- Relocate an unchanged selected header when rows are inserted above it, but stop and require review when the header materially changes.
- Let administrators review and edit header selection from the connection detail page before refreshing a dataset.
- Refresh the connection state and final message when a background import finishes so **Open dataset** appears without a browser reload.
- Re-import the existing Sudan source after production deployment and verify corrected headers and data-row count.
- Keep private source data out of committed fixtures by using minimal synthetic examples based on the observed structures.

Non-goals: Google user OAuth, Drive browsing, AI/LLM-based semantic header inference, multi-tab joins, automatic partner-field mapping, and silently changing a confirmed manual header selection.

## Capabilities

### New Capabilities

- `google-sheets-header-selection`: Deterministic header recommendation, administrator preview/override, optional multi-row composition, persistence, and safe header relocation.

### Modified Capabilities

- `api-connection-runs`: Successful background imports refresh connection-level dataset state and expose navigation without requiring a browser reload.

## Impact

- Google Sheets parsing and provider configuration in `src/lib/google-sheets.ts`, `src/lib/api-types.ts`, and `src/lib/api-connections/**`.
- Administrator connection setup/detail UI and API routes under `src/components/dashboard/**` and `src/app/api/admin/api-connections/google-sheets/**`.
- Synthetic unit, route, component, and UI smoke coverage, plus user documentation.
- Data integrity improves because pre-header rows are excluded and ambiguous changes block mutation. Existing admin authorization, same-origin mutation protection, service-account read-only access, Supabase private storage, and public API exposure do not change.
- Provider configuration remains in the existing private `api_connections.provider_config` JSON; no new public database surface is introduced. A migration is required only if repository verification determines an explicit backfill is safer than compatibility defaults.
- The change affects the Next.js UI and production Vercel deployment and therefore requires UI smoke coverage, full change verification, OpenSpec archive, and the repository PR/release workflow.
