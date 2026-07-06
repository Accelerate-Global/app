## Why

Google Sheets connections currently require each dataset admin to authorize a Google account through OAuth, which creates product and operational friction for a shared admin workflow. A service-account share model is simpler, keeps private Sheets private, and lets the app own refreshable access without exposing Google account OAuth as a user-facing connection path.

## What Changes

- **BREAKING**: Remove Google account OAuth as the live Google Sheets connection product path, including OAuth start/callback and draft-based connection completion behavior.
- Add a service-account share workflow where the app shows the configured service account email, the admin shares the Sheet with that email as a Viewer, pastes the Google Sheet URL, checks access, selects readable tabs and classification, then creates connections.
- Preserve private Sheet support; admins must share the Sheet with the app service account and must not be asked to publish Sheets publicly.
- Preserve one refreshable API connection per selected tab using the existing Google Sheets provider config shape: spreadsheet ID, spreadsheet URL, spreadsheet title, sheet ID, sheet title, and `rangeMode: "full_tab"`.
- Preserve the existing API connection run lifecycle, output artifacts, Google Sheets parsing, first-import dataset creation, and later refresh/replace behavior.
- Define user-facing failure states for missing service-account configuration, invalid URLs, Sheets not shared with the service account, no readable tabs, missing header rows, parse failures, and oversized imports.
- Update the API Connections UI and connected Google Sheets detail/list actions around service-account connection management: refresh now, open dataset, open Google Sheet, check access, copy app email, and disconnect.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `api-connection-runs`: Replace OAuth/draft-based Google Sheets connection requirements with service-account share requirements while preserving tab-backed refreshable dataset runs.

## Impact

- Affects admin-only Google Sheets routes under `src/app/api/admin/api-connections/google-sheets/**`, API connection domain logic under `src/lib/api-connections/**`, Google Sheets helpers, `src/lib/api-types.ts`, the API Connections dashboard UI, related route/component/unit tests, and UI smoke contracts for the connection surface.
- Affects Supabase schema/migrations by removing live dependence on `private.api_connection_oauth_credentials`, `private.google_sheets_connection_drafts`, and `private.api_connections.oauth_credential_id` for new Google Sheets behavior without editing historical migrations.
- Affects API contracts and generated response types because OAuth/draft response shapes are replaced by service-account config, access-check, tab-selection, and connection-create response shapes.
- Affects admin permissions and data integrity: all service-account connection routes remain dataset-admin-only, and failed access, failed parsing, or oversized imports must not replace existing datasets.
- Affects server environment configuration by requiring Google service-account credentials and exposing only the service account email to admins.
- Does not change generic API connection profile write restrictions, existing run history/download behavior, dataset import/replace mechanics, Google Sheets row parsing rules, Supabase RLS posture, Vercel deployment mechanics, or code-managed non-Google providers.
