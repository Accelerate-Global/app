## Why

The Google Sheets connection flow currently asks which tabs and classification to use but does not ask whether the datasets created by the first import should be visible to non-admin users. As a result, every newly imported Sheet tab starts workspace-visible even when an administrator intends to stage it privately.

## What Changes

- Add an explicit dataset visibility choice to the Google Sheets connection flow, shared by all tabs selected in that connection action and defaulting to workspace-visible.
- Show the red, system-managed `Private` tag in the setup flow when the administrator chooses to hide the imported datasets from non-admin users.
- Include the visibility choice in the Google Sheets connect API contract and persist it in every created connection's provider configuration.
- Apply the saved choice when a connection's first successful import creates its dataset. Private datasets inherit the existing automatic `Private` tag invariant.
- Treat legacy Google Sheets connections without the saved choice as workspace-visible.
- Preserve an existing dataset's current visibility on later refreshes instead of reapplying the connection's initial choice.

### Non-goals

- This change does not alter the source Google Sheet's sharing or privacy settings.
- This change does not add per-tab visibility choices; one selection applies to every tab connected in the same action.
- This change does not change existing datasets or existing connection records.
- This change does not alter authentication, administrator permissions, RLS policies, or Vercel deployment behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `api-connection-runs`: Google Sheets connection setup collects, persists, previews, and applies the initial workspace visibility of imported datasets.

## Impact

- UI: `src/components/dashboard/api-connections-client.tsx` and its component and browser-smoke coverage.
- API contract: `src/app/api/admin/api-connections/google-sheets/connect/route.ts` accepts a dataset visibility boolean while remaining compatible with callers that omit it.
- Connection domain and types: `src/lib/api-connections/index.ts` and `src/lib/api-types.ts` persist the choice in the existing JSONB provider configuration.
- Dataset creation: `src/lib/datasets.ts` accepts the initial workspace visibility so the existing database-enforced `Private` tag behavior applies to private imports.
- Supabase/data integrity: no schema migration is required because provider configuration is JSONB; the existing dataset visibility column and system-managed tag trigger remain the source of truth.
- UI smoke: the Google Sheets connection journey gains assertions for the visibility control and private-state preview.
