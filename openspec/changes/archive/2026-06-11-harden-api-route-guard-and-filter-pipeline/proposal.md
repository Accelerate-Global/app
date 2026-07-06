## Why

Recent PR-readiness review found that two already-implemented behavior changes were not captured in durable specs: protected API routes now use a centralized route guard, and saved-table CSV downloads now share the same canonical filter pipeline as the dashboard/default-view paths. The route guard also needs to normalize identity-resolution failures so the documented API error contract is actually enforced.

## What Changes

- Add a durable API route security capability for centralized identity resolution, admin checks, documented route exemptions, and normalized unexpected errors.
- Update authenticated dataset access requirements so saved-table downloads use the same persisted-filter evaluation as dashboard views and dataset default filtering, including hotspots ranking against UUPG criteria.
- Fix `withRoute` so identity lookup failures are logged and returned as normalized JSON 500 responses.
- Keep route-specific payload/domain behavior in handlers while cleaning the wrapper formatting introduced by the broad guard refactor.
- Preserve existing verification policy by updating same-stem tests rather than changing `verify:test-delta`.

## Capabilities

### New Capabilities
- `api-route-security`: Cross-cutting API route identity, authorization, exemption, and unexpected-error behavior.

### Modified Capabilities
- `authenticated-dataset-access`: Saved-table downloads must evaluate saved filters through the canonical dataset filter pipeline.

## Impact

- Affects auth and admin-permission behavior for `src/app/api/**/route.ts`.
- Affects saved-table CSV download data integrity by aligning server export filtering with the client/default-view pipeline.
- Affects local verification through OpenSpec validation, same-stem unit tests, app verification, and DB security checks.
- Does not change Supabase RLS, database schema, Vercel deployment behavior, or UI smoke coverage.
