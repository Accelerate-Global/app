## Context

The repo already has an admin-only API Connections surface backed by `private.api_connections`, async run records, archived output artifacts, and dataset create/replace imports. Generic profile writes are disabled in the web API, while code-managed connections are listed and materialized before first run. Google Sheets needs to fit that lifecycle while adding private OAuth and tab selection.

## Goals / Non-Goals

**Goals:**

- Let dataset admins create private Google Sheets connections from the app.
- Store Google refresh tokens server-side in Supabase Vault and never expose them to clients, logs, previews, or artifacts.
- Create one connection per selected Sheet tab and refresh the same dataset after the first successful import.
- Preserve existing HTTP API connection behavior and run history/download behavior.

**Non-Goals:**

- No public/published-only Sheets mode in v1.
- No Google Drive file browser or broad Drive integration.
- No manual A1 range selection; v1 imports the full used range for selected tabs.
- No generic web editing for existing API connection profiles.

## Decisions

- Add a provider discriminator to API connections. Existing rows default to `http_api`; new Google Sheets rows use `google_sheets` with provider config for spreadsheet ID/title, sheet ID/title, source URL, and full-tab range mode.
- Use connection-owned OAuth credentials. The credential records live in the private schema, point to a Vault secret containing the refresh token, and can be shared by multiple tab connections from the same OAuth flow.
- Use a short-lived Google Sheets connection draft for OAuth state and tab selection. The draft starts with the pasted Sheet URL, is completed by the OAuth callback, and is consumed when selected tabs create connections.
- Use `spreadsheets.readonly` OAuth scope. Private pasted Sheet URLs require direct Sheets read access; `drive.file` would require a Picker/file-open model that is out of scope for v1.
- Fetch Google Sheets via fixed Google API hosts. User-provided Sheet URLs are parsed for IDs only, avoiding user-controlled outbound fetch destinations.
- Treat the first non-empty row as headers. Remaining non-empty rows become dataset rows with existing header normalization and dataset byte limits.
- On a Google Sheets import with no target dataset, create a dataset and update the connection to replace that dataset on future imports. On later imports, reuse existing `replaceDatasetContents`.

## Risks / Trade-offs

- Google `spreadsheets.readonly` is a sensitive OAuth scope and may require Google Cloud consent/verification before production use. Mitigation: document required env/provider setup and keep scope limited to read-only Sheets.
- Stored refresh tokens can expire or be revoked externally. Mitigation: failed refreshes record a failed run without replacing the current dataset.
- Multi-tab selection creates multiple connections, which is more visible than one spreadsheet row. Mitigation: it matches the current one-run-one-dataset model and keeps dataset replacement simple.
- Full-tab imports can be large. Mitigation: enforce existing dataset size limits before dataset writes.
