## 1. Service Account Core And Schema

- [x] 1.1 Replace Google Sheets OAuth helpers with server-only service-account configuration parsing, readonly token minting, and redacted provider error handling while preserving URL parsing, metadata fetch, tab values fetch, row normalization, and size checks.
- [x] 1.2 Add service-account access-check domain helpers that return the copyable app email, validate Google Sheet URLs, fetch spreadsheet title and readable tabs, and distinguish missing env, invalid URL, unshared Sheet, and no-readable-tabs failures.
- [x] 1.3 Update the Google Sheets connection provider so test/import runs use service-account access tokens instead of stored OAuth credentials and preserve failed-run/no-dataset-replacement behavior for access, parse, and size failures.
- [x] 1.4 Add a Supabase migration and Drizzle schema update that remove or retire live dependence on `private.api_connection_oauth_credentials`, `private.google_sheets_connection_drafts`, and `private.api_connections.oauth_credential_id` without editing historical migrations or deleting imported datasets.
- [x] 1.5 Replace OAuth/draft API response types in `src/lib/api-types.ts` with service-account config, access-check, tab-selection, connection-create, and connection-access-check response shapes.

## 2. Admin Routes And API Contracts

- [x] 2.1 Replace `src/app/api/admin/api-connections/google-sheets/oauth/**` and `src/app/api/admin/api-connections/google-sheets/drafts/**` live behavior with admin-only service-account routes for reading app email/config status, checking pasted Sheet access, creating selected tab connections, and checking saved connection access.
- [x] 2.2 Ensure all mutating Google Sheets provider routes remain covered by the centralized same-origin/admin route guards and remove any obsolete OAuth callback route-guard exemption.
- [x] 2.3 Re-check service-account access during tab connection creation and insert one API connection per selected tab with the existing provider config shape and selected dataset classification.
- [x] 2.4 Update disconnect behavior so it removes the selected Google Sheets connection without OAuth credential revocation while preserving datasets, run history, and archived outputs.

## 3. Dashboard UI And Documentation

- [x] 3.1 Replace the API Connections Google Sheets creation UI with the service-account workflow: copy app email, paste Google Sheet URL, check access, choose tabs, choose classification, and connect.
- [x] 3.2 Add connected Google Sheets list/detail actions for refresh now, open dataset, open Google Sheet, check access, copy app email, and disconnect.
- [x] 3.3 Remove live UI copy and documentation that presents Google account OAuth as the Google Sheets connection method, and document service-account setup and required environment variables in current developer docs and `.env.example`.
- [x] 3.4 Update UI smoke markers, route registry entries, and smoke fixtures for any changed page, sheet, dialog, menu, tooltip, or popover surfaces touched by the workflow.

## 4. Tests

- [x] 4.1 Update Google Sheets unit tests for service-account env parsing, token minting/redaction, URL parsing, access-check metadata, no-readable-tabs handling, full-tab value parsing, missing header rows, and oversized imports.
- [x] 4.2 Update API connection provider/run tests so service-account Google Sheets runs create the first dataset, refresh the same dataset on later imports, and preserve existing datasets on access, parse, or size failures.
- [x] 4.3 Replace OAuth/draft route tests with service-account route tests for admin authorization, config status, invalid URL, unshared Sheet, no readable tabs, selected-tab validation, one-connection-per-tab creation, saved connection access checks, and disconnect.
- [x] 4.4 Update API Connections dashboard component/page tests for the service-account workflow, expected failure states, connected Sheet actions, refresh labels, and removal of OAuth fallback UI.
- [x] 4.5 Update schema and migration tests to reflect the live service-account schema and the removal or retirement of OAuth credential/draft structures.

## 5. Verification And OpenSpec Lifecycle

- [x] 5.1 Run `pnpm run verify:change` after implementation planning and complete every command it lists for the changed tree.
- [x] 5.2 Run focused direct tests for touched same-stem unit, route, component, schema, and migration test files.
- [x] 5.3 Run `pnpm run smoke:check` after UI contract changes and run targeted UI smoke only if `pnpm run verify:change` requires it or browser-specific debugging is needed.
- [x] 5.4 Run `pnpm run spec:validate` and `pnpm run verify:change:run` before finalizing implementation.
- [x] 5.5 If repo-local Docker or Supabase services are started, stop them with the repo-scoped shutdown command and run the required Docker cleanup while preserving local persistent data unless explicitly reset.
- [x] 5.6 Archive the OpenSpec change after implementation and required repo verification pass, before any ship-local or release work.
