## Why

Dataset admins need refreshable Google Sheets sources, not one-off CSV uploads. A private Sheet connection should live in the existing admin Datasets/API Connections workflow so admins can connect a Sheet once, import selected tabs, and refresh those datasets later.

## What Changes

- Add Google Sheets as an in-app API connection provider for dataset admins.
- Add a private Google OAuth flow for Sheets read-only access, with refresh tokens stored in Supabase Vault.
- Let admins paste a Google Sheet link, authorize Google, choose one or more tabs, and create one refreshable connection per tab.
- Import each selected tab as a normal shared dataset on the first run, then replace that same dataset on later refreshes while preserving dataset version history.
- Extend the API Connections UI to start the Google Sheets flow and show Google Sheet connections alongside code-managed API connections.
- Preserve existing generic API connection profile write restrictions; only Google Sheets provider-specific creation and cleanup are added.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `api-connection-runs`: Adds Google Sheets OAuth connection creation, tab-backed connections, and refresh behavior through the existing async API connection run lifecycle.

## Impact

- Affects admin APIs under `src/app/api/admin/api-connections/**`, the API connection domain logic in `src/lib/api-connections.ts`, API types and validation, the API Connections dashboard UI, and related tests.
- Adds Supabase migrations and Drizzle schema for provider metadata, OAuth credentials, and Google Sheets connection drafts, with private-schema RLS and revoked public/anon/authenticated access.
- Adds server-only Google OAuth environment variables documented for local and deployed environments.
- Affects auth/admin permissions, data integrity, Supabase/Vault usage, API contracts, and UI smoke coverage.
- Does not change anonymous access, non-admin dataset access, generic API connection editing, saved-table privacy, Vercel deployment mechanics, or existing code-managed IMB/Etnopedia/Joshua Project behavior.
