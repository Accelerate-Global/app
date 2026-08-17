## Why

Google Sheets connection details currently lead with a large provider-specific source card, while other connection details lead with `Source status` and then `Run history`. This makes equivalent connection pages feel inconsistent and gives infrequently used setup and maintenance controls more visual weight than ongoing run operations.

## What Changes

- Replace the always-visible Google Sheets source card with a compact `Google Sheets source` button in the connection-detail header area.
- Open a right-side sheet from that button containing the existing spreadsheet metadata, service-account access details, workflow assignment, header review, access check, dataset/Sheet links, and disconnect controls.
- Make `Source status` the first full-width content card for Google Sheets connections, followed by `Run history`, matching other provider detail pages.
- Add explicit smoke trigger, surface, ready, and close markers for the new sheet interaction and update direct component/browser coverage.
- Preserve existing Google Sheets data, actions, permissions, API behavior, workflow rules, and run behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `api-connection-runs`: Change the Google Sheets connection-detail presentation so secondary source configuration is available in a side sheet while status and history remain the primary page content.

## Impact

- Primary UI: `src/components/dashboard/api-connection-detail-client.tsx`.
- Tests: `src/components/dashboard/api-connection-detail-client.test.tsx` and the relevant API-connection journey in `tests/ui/10-journeys.spec.ts`.
- Existing shared `Sheet` primitives are reused; no new dependency or shared UI primitive is required.
- UI smoke coverage changes because a new smokeable sheet trigger/surface is introduced. Auth, admin permissions, data integrity, Supabase, Vercel deployment, and API contracts are unchanged.
- Non-goals: moving Google Sheets configuration to another route, changing onboarding, changing provider APIs, changing workflow assignment semantics, or removing any existing maintenance action.
