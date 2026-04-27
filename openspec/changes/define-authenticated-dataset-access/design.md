## Context

Authenticated dataset access currently crosses these boundaries:

- Supabase identity resolution in `src/lib/auth.ts`.
- App-layer dataset filtering in `src/lib/datasets.ts`.
- Saved-table ownership and dataset joins in `src/lib/saved-dataset-tables.ts`.
- Dataset pages under `src/app/dashboard/datasets`.
- Dataset and saved-table JSON APIs under `src/app/api`.
- Supabase RLS policies in `supabase/migrations`.
- UI smoke coverage in `tests/ui/route-registry.ts`.

## Goals / Non-Goals

**Goals:**

- Specify behavior before changing implementation.
- Align browser and JSON access outcomes.
- Preserve privacy for private/missing/unauthorized datasets.
- Capture saved-table ownership and underlying dataset access as one contract.
- Identify direct, smoke, and DB verification needed for implementation.

**Non-Goals:**

- Redesign all auth/session behavior.
- Redesign upload/import internals.
- Specify unrelated admin management or API connection behavior.
- Backfill broad legacy specs.

## Current Flow Overview

- Anonymous users are redirected from dashboard pages to `/` and receive `401`
  from dataset/saved-table JSON APIs.
- Viewers read datasets through helpers that require `datasets.isPublic=true`.
- Admins pass `includeDisabled=true` in app-layer helpers and can read private
  datasets.
- Supabase RLS allows authenticated users to read public datasets and rows, and
  admins to read private datasets and rows.
- Saved tables are owner-scoped and currently joined to public datasets.

## Auth And Permission Boundaries

- `CurrentIdentity.ownerId` is the app-layer owner identifier for saved tables.
- `CurrentIdentity.isDatasetAdmin` is derived from Supabase app metadata.
- Viewer dataset access is public-only.
- Admin dataset access is public plus private.
- Admin-only dataset actions include dataset creation, mutation, deletion,
  replacement, row batch writes, version history/revert, reordering, and derived
  assignment.

## Dataset Page And API Behavior Alignment

- Browser pages should redirect anonymous users before loading dataset data.
- Dataset detail/edit pages should use not-found behavior for missing or
  inaccessible datasets.
- Dataset read APIs should return `401` when unauthenticated and `404` when a
  dataset is missing or inaccessible.
- Dataset admin APIs should return `401` when unauthenticated and `403` when an
  authenticated non-admin attempts admin-only behavior.
- Dataset download endpoints should perform the same access check before creating
  signed Supabase Storage URLs or derived CSV responses.

## Saved-Table Access Model

- Saved-table records are owner-scoped by `ownerId`.
- Saved-table operations must require both saved-table ownership and access to
  the underlying dataset.
- Saved-table reads, updates, deletes, opens, and downloads should return not
  found when ownership or underlying dataset access fails.
- Open question: whether admins should be able to save private dataset views for
  their own account. If yes, saved-table helpers need role-aware dataset access
  instead of public-only joins.

## Error, Redirect, And Status-Code Model

- Browser anonymous access to dashboard dataset surfaces: redirect to `/`.
- Browser authenticated access to missing/inaccessible dataset: not found.
- JSON anonymous access: `401 Unauthorized`.
- JSON authenticated non-admin access to admin-only action: `403 Forbidden`
  style response through `jsonAdminOnlyError`.
- JSON read of missing/inaccessible dataset or saved table: `404 Not Found`.
- Private dataset existence should not be exposed through different viewer
  responses.

## Data And RLS Considerations

- RLS remains required on `datasets`, `dataset_rows`, and `saved_dataset_tables`.
- Dataset and row RLS should continue to mirror app-layer access:
  public datasets for authenticated users, private datasets for admins.
- Saved-table RLS currently protects ownership. If saved-table behavior changes
  to support private datasets for admins, app-layer checks and RLS/test coverage
  need review together.
- Admin role checks must continue using Supabase app metadata rather than
  user-editable metadata.

## Verification Strategy

- Run `pnpm run verify:change` before implementation to identify required gates.
- Add or update direct tests for touched route handlers and helper functions.
- Run `pnpm run smoke:check` for UI smoke contract changes.
- Run targeted UI smoke for dashboard/dataset/saved-table flows when page
  behavior changes.
- Run `pnpm run db:security` if RLS policies or Supabase migrations change.
- Run `pnpm run verify:change:run` before finalizing implementation.

## Rollout / Recovery Considerations

- This proposal does not change runtime behavior.
- Implementation should be split so app-layer access behavior and any RLS changes
  can be reviewed independently when possible.
- If RLS changes are needed, preserve a reversible migration path and verify
  locally before remote migration work.

## Decisions

- Treat missing and unauthorized read resources as not found for authenticated
  users to avoid private dataset enumeration.
- Keep saved tables owner-scoped.
- Tie saved-table usability to the requester's access to the underlying dataset.
- Keep private dataset admin access explicit and role-based.

## Risks / Trade-offs

- Current saved-table public-only joins may conflict with desired admin-private
  saved-table behavior.
- API and page behavior may drift unless tests cover both.
- Supabase RLS and app-layer checks can diverge if future changes update only one
  layer.
