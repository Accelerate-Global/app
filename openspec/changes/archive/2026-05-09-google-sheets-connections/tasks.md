## 1. Data Model And Provider Core

- [x] 1.1 Create a Supabase migration for API connection provider metadata, OAuth credentials, and Google Sheets connection drafts with private-schema RLS and revoked public/anon/authenticated access.
- [x] 1.2 Update Drizzle schema and API types for provider, provider config, OAuth credential, and Google Sheets draft records.
- [x] 1.3 Implement Google Sheet URL parsing, OAuth URL construction, token exchange/refresh, metadata fetch, and values fetch helpers.
- [x] 1.4 Add Google Sheets parsing from full-tab values into normalized dataset rows with existing header and size behavior.
- [x] 1.5 Extend API connection run execution so Google Sheets runs use fixed Google APIs and first import binds the connection to the created dataset.

## 2. API Routes And UI

- [x] 2.1 Add admin-only provider routes for OAuth start, OAuth callback, draft retrieval, tab confirmation, and connection disconnect/cleanup.
- [x] 2.2 Add the in-app Google Sheets creation flow to the API Connections page and tab-selection page with required smoke markers.
- [x] 2.3 Update connection list/detail UI copy and actions so Google Sheets connections show refresh behavior after a target dataset exists.
- [x] 2.4 Register any new page route and smoke surfaces in the UI smoke registry/contracts.
- [x] 2.5 Document required Google OAuth environment variables and provider setup.

## 3. Tests And Verification

- [x] 3.1 Add unit tests for URL parsing, Google Sheets row normalization, OAuth/token redaction, and provider run behavior.
- [x] 3.2 Add route tests for admin authorization, OAuth state handling, draft confirmation, and generic profile-write restrictions.
- [x] 3.3 Add component/page tests for Google Sheets creation UI, tab selection, list rows, and detail refresh labels.
- [x] 3.4 Run `pnpm run verify:change`, complete every required command it lists, and run `pnpm run verify:change:run`.
- [x] 3.5 If local Supabase or Docker services are started, stop repo-local services and run the required Docker cleanup before finalizing.
