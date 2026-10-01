## Why

A workspace-visible derived dataset can currently read rows from a restricted backing dataset, and revoked users can continue to use unexpired Supabase JWTs against direct Data API and Storage policies. The current lockfile also fails the protected dependency audit with critical and high advisories.

## What Changes

- Require non-admin dataset reads to authorize both a derived view and its backing source. Prevent new or changed visibility relationships that would expose a restricted source.
- Require a current, enabled Auth user and live session for direct Supabase dataset and Storage access, including admin policies, while retaining the existing role model.
- Update compatible direct and transitive dependencies so the high-severity audit gate passes; retain existing application behavior.
- Add application and local database regressions for the access boundaries.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `authenticated-dataset-access`: Derived reads and direct Supabase policies must fail closed when the source or session is inaccessible.
- `workspace-role-permissions`: Disabling an account must end workspace data access even while an old access token remains cryptographically valid.
- `dependency-security`: The installed tree must clear the protected high-severity audit threshold.

## Impact

- Auth, admin permissions, data integrity, Supabase RLS and Storage, dataset APIs, and dependency resolution are affected. There is no intended Vercel deployment contract or UI smoke change.
- Relevant current code: `src/lib/datasets.ts`, `src/lib/user-management.ts`, `src/app/api/datasets/[datasetId]/rows/route.ts`, `supabase/migrations/20260714172000_rename_dataset_visibility_to_workspace_visible.sql`, `src/lib/supabase/admin.ts`, and `package.json`/`pnpm-lock.yaml`.
- Existing API outcomes for permitted datasets, admin access to restricted datasets, invitation flow, and origin protection remain unchanged. No production probing or account migration is part of this change.
