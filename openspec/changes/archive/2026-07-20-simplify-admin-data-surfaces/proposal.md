## Why

The admin navigation currently exposes two specialist pages—Field Sources and
Analytics—that duplicate clearer product surfaces and add cognitive load without
helping administrators make routine decisions. Administrators instead need
concise authentication recency in User Management and consistent freshness
metadata for connection resources.

## What Changes

- **BREAKING**: Remove the standalone Field Sources UI and its unused read API;
  remove its account-menu entry and redirect the retired route to Definitions.
- **BREAKING**: Remove the standalone Analytics dashboard, failure-triage UI,
  and its mutation API; remove its account-menu entry and redirect the retired
  route to User Management.
- Keep the underlying field-source registry because Definitions uses it to show
  which source databases link to each shared definition.
- Keep authenticated app-owned operational analytics persistence; the existing
  Vercel Web Analytics collector pause remains unchanged.
- Add a `Last sign-in` column to User Management using Supabase Auth's existing
  `last_sign_in_at` value, with a clear never-signed-in state. Do not label this
  value `Last activity` or infer sign-in frequency.
- Replace the Connections Resources card's bordered row list with the same table
  treatment used by Dataset sources, including Source, Entries, and Last updated
  columns for built-in and captured resources.
- Update route coverage, targeted smoke selection, tests, and user-facing docs
  so removed surfaces are not advertised or browser-smoked as standalone pages.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `dashboard-layout`: Retire the Field Sources and Analytics navigation entries
  and redirect their old routes to Definitions and User Management.
- `workspace-role-permissions`: Show Supabase Auth last-sign-in recency in the
  admin User Management table without claiming broader activity tracking.
- `reference-resources`: Present connection resources in a consistent metadata
  table with entry counts and freshness timestamps.
- `api-connection-runs`: Keep the Connections index contract aligned with the
  Resources card's new metadata-table presentation.
- `analytics-failure-triage`: Remove the user-facing analytics dashboard and
  failure-triage mutation surface while retaining internal event persistence.

## Impact

- UI/routes: `src/components/auth/account-control.tsx`, retired dashboard pages,
  User Management, Definitions, and API Connections components.
- APIs: retires `/api/field-sources` and
  `/api/admin/analytics/failure-triage`; existing Supabase-backed user listing
  remains admin-only and already returns `lastLoginAt`.
- Data integrity: no schema migration or destructive data deletion; field-source
  mappings and historical internal analytics data remain intact.
- Supabase: reads the existing `auth.users.last_sign_in_at` value already shaped
  by `src/lib/user-management.ts`; no new auth permissions or client-side
  service-role exposure.
- Vercel: no deployment-setting change. `docs/architecture/current-state.md`,
  `openspec/specs/vercel-analytics-pause/spec.md`, and the root layout establish
  that the Vercel collector is not mounted even though app-owned events persist.
- Verification: route registry, UI journeys, component/page tests, smoke
  selection, OpenSpec validation, application verification, and targeted browser
  smoke are affected.

### Non-goals

- Do not delete the field-source registry, seed data, or mappings used by
  Definitions.
- Do not delete historical analytics tables or remove operational event tracking
  across the application.
- Do not introduce session-frequency, pageview, or generalized `Last activity`
  tracking.
- Do not alter workspace roles, invitation behavior, or account-management
  permissions.
