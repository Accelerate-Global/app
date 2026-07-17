## Why

The admin ingestion surface currently mixes the visible labels “Datasets,” “Data sources,” and “Add dataset” even though the page manages connection records. Calling the surface and its Google Sheets creation entry point “Connections” makes the navigation and workflow match the object being managed, while removing the unrelated reference-resources card keeps the page focused.

## What Changes

- Rename the visible admin navigation item and `/dashboard/api-connections` page heading to `Connections`.
- Rename the page’s creation action to `Add connection` and deep-link it to the existing Google Sheets connection flow.
- Present the Google Sheets deep-linked onboarding page as `Add connection` while preserving the general `Add dataset` flow used for CSV uploads and source selection.
- Rename connection-detail and onboarding cross-links from `Data sources` to `Connections`.
- Remove the reference-resources card from the Connections index.
- Preserve `/dashboard/api-connections`, `/dashboard/datasets/new`, all API contracts, resource persistence, authentication, admin authorization, dataset import behavior, Supabase behavior, and Vercel deployment behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `api-connection-runs`: Change the visible admin connection-management terminology, Google Sheets creation entry point, and index contents.

## Impact

- UI and tests: `src/app/dashboard/api-connections/**`, `src/app/dashboard/datasets/new/**`, `src/components/dashboard/api-connections-client.tsx`, `src/components/dashboard/dataset-onboarding/dataset-onboarding-client.tsx`, `src/components/auth/account-control.tsx`, and their directly mapped tests.
- Durable behavior: `openspec/specs/api-connection-runs/spec.md` receives the archived delta after verification.
- UI smoke: existing route registry entries and literal page markers remain unchanged because no route is added or removed; visible assertions may require updates.
- No impact to auth, admin permissions, data integrity, Supabase schema or migrations, Vercel deployment, or HTTP API contracts.
