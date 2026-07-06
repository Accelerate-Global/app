## Context

Google Sheets is currently wired as an admin-only provider inside the existing API Connections domain, but its creation path is OAuth-centered: routes live under `src/app/api/admin/api-connections/google-sheets/oauth/**` and `src/app/api/admin/api-connections/google-sheets/drafts/**`, domain logic stores short-lived drafts in `private.google_sheets_connection_drafts`, and refresh credentials are stored through `private.api_connection_oauth_credentials` plus `private.api_connections.oauth_credential_id`. The run lifecycle, output artifacts, dataset import/replace flow, and Google Sheets full-tab parser already fit the desired model and should stay.

The replacement workflow should make Google Sheets access app-owned instead of admin-account-owned. Dataset admins share a private Sheet with the app service account as a Viewer, paste the Sheet URL, let the server verify access through fixed Google APIs, choose tabs and classification, and create one connection per selected tab.

## Goals / Non-Goals

**Goals:**

- Remove Google account OAuth and draft completion from the live Google Sheets product path.
- Keep Google Sheets connections admin-only and keep private Sheets private by requiring explicit sharing with the app service account.
- Expose only the service account email to admins; keep private keys, signed assertions, access tokens, and provider errors server-side and redacted.
- Preserve the existing provider config shape for tab connections: spreadsheet ID, spreadsheet URL, spreadsheet title, sheet ID, sheet title, and `rangeMode: "full_tab"`.
- Preserve the existing async run lifecycle, archived JSON/CSV outputs, row parsing rules, first-import dataset creation, later dataset replacement, and failure behavior that leaves existing datasets untouched.
- Replace OAuth/draft API types with service-account config, access-check, tab-selection, and connection-create response types.

**Non-Goals:**

- No user OAuth fallback, Google account picker, Drive file browser, or public/published-Sheet import mode.
- No manual A1 range selection; service-account Google Sheets connections continue to import the full selected tab.
- No broad redesign of API connection runs, output archives, generic HTTP providers, or dataset replacement semantics.
- No edits to historical migrations or archived OpenSpec history; new migrations and current specs own the live behavior.

## Decisions

- Service-account sharing becomes the only Google Sheets creation path. The UI should show a copyable app email first, then a Sheet URL field, `Check access`, tab selection, classification selection, and `Connect`. OAuth start/callback and draft routes should be removed from the surfaced UI and live API contract rather than hidden behind a fallback.
- The server should mint Google access tokens from service-account credentials at request/run time. Use server-only environment configuration for the service account client email/private key or equivalent JSON payload, request only the Sheets readonly scope, and keep token creation in server modules used by route handlers and the provider. The service account email is the only credential-derived value returned to the browser.
- Access checks should parse the pasted URL into a spreadsheet ID and normalized URL, then call Google Sheets metadata through fixed Google API hosts with the service account. The response should contain spreadsheet title and readable tab metadata only after access succeeds. Invalid URLs, unshared Sheets, no readable tabs, and missing service-account env should produce distinct user-facing errors and must not create connections.
- Tab connection creation should be stateless relative to OAuth drafts. The confirmed create request should include the checked spreadsheet metadata, selected sheet IDs, and classification; the server should re-check service-account access before inserting one `private.api_connections` row per selected tab.
- The live schema should stop depending on OAuth credential records for Google Sheets. A new migration should remove or retire `private.google_sheets_connection_drafts`, `private.api_connection_oauth_credentials`, and `private.api_connections.oauth_credential_id` from current code paths after existing Google Sheets rows have been migrated to service-account semantics. Existing Google Sheets connection rows retain provider config and target dataset IDs; future refreshes succeed once the Sheet is shared with the service account.
- Disconnect should delete the selected Google Sheets API connection row without attempting OAuth credential revocation. Dataset rows, prior run history, and output artifacts should continue to follow existing API connection cleanup semantics.
- Connected Google Sheets list/detail actions should include refresh now, open dataset when a target exists, open Google Sheet, check access, copy app email, and disconnect. `Check access` on an existing connection should verify the saved spreadsheet/tab metadata with the service account and report actionable access or tab-missing failures.
- Tests should move from OAuth state/draft coverage to service-account coverage: URL parsing, service-account env errors, token redaction, metadata access checks, one-connection-per-tab creation, admin authorization, UI states/actions, and failed run behavior that preserves existing datasets. UI smoke coverage should be updated for the changed connection surface and any new sheet/dialog/popover markers.

## Risks / Trade-offs

- Existing connected Sheets may not be shared with the service account when the change ships. Mitigation: keep provider config and datasets intact, surface `Check access` and copy-app-email actions, and fail refreshes without replacing current datasets until sharing is fixed.
- Service-account private key formatting varies across environments. Mitigation: centralize env parsing, support newline-normalized private keys or a JSON credential payload, and test missing/malformed env states.
- Removing OAuth schema objects can strand Vault secrets from prior credentials. Mitigation: include a cleanup task for legacy credential secrets when feasible, but never block dataset preservation on secret cleanup.
- Google API denial responses can be ambiguous between not shared, deleted, or permission-restricted Sheets. Mitigation: present a clear user-facing "share this Sheet with the app email as Viewer" state while logging normalized provider details server-side.
- Re-checking access during create adds one more Google API call. Mitigation: it prevents stale or tampered client metadata from creating broken connections and keeps the database authoritative.

## Migration Plan

1. Add service-account helpers and route contracts while keeping the existing run lifecycle unchanged.
2. Replace the creation UI and API types so no live user path calls OAuth start/callback or draft endpoints.
3. Migrate current Google Sheets connection rows to service-account refresh semantics by preserving provider config, target dataset IDs, run history, and dataset bindings while removing OAuth credential dependence.
4. Add a Supabase migration for live schema cleanup or retirement of OAuth credential/draft structures; do not edit historical migrations.
5. Remove OAuth/draft code, tests, route-guard exemptions, and docs from current source, replacing them with service-account setup documentation.
6. Validate OpenSpec, targeted unit/route/component tests, smoke contract checks, and the repo change gate.

Rollback is to revert the application/schema change before deleting legacy credential data. After OAuth tables/columns are dropped, rollback requires restoring the previous migration path or keeping a compatibility migration ready; dataset records and imported data remain preserved either way.

## Open Questions

- None for the planned behavior. Implementation should choose the final environment variable names and document them in `.env.example` and developer setup docs.
