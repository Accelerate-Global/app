## Summary

Define the durable behavior contract for authenticated dataset access across
dataset pages, dataset APIs, row APIs, downloads, saved tables, and dashboard
flows.

## Problem Statement

Dataset access behavior currently exists in app code, Supabase RLS migrations,
and UI smoke tests, but there is no single behavior spec describing the contract
for anonymous users, authenticated viewers, and authenticated admins. This makes
future changes to private datasets, saved tables, downloads, or row APIs easy to
implement inconsistently.

## Goals

- Define the access terminology for admin-uploaded/default datasets, public and
  private datasets, derived datasets, and user-saved dataset views.
- Define who can access public, private, missing, and unauthorized datasets.
- Align dashboard pages, dataset APIs, row APIs, downloads, and saved-table
  behavior.
- Define redirect, not-found, and JSON status-code expectations.
- Keep saved-table access owner-scoped and tied to underlying dataset access.
- Preserve Supabase RLS as a defense-in-depth boundary for dataset metadata and
  rows.
- Identify tests and UI smoke coverage needed before implementation.

## Non-Goals

- Redesign all authentication or account lifecycle behavior.
- Redesign admin user management or first-admin bootstrap.
- Redesign upload/import/version history workflows beyond their access checks.
- Redesign API connection management.
- Add broad baseline specs for untouched legacy behavior.
- Change Supabase or Vercel provider-level configuration without a specific
  implementation need.

## Current Evidence From Repo Files

- `src/lib/auth.ts` resolves Supabase users and derives `isDatasetAdmin` from
  `user.app_metadata?.workspace_role`.
- `src/lib/datasets.ts` filters non-admin dataset reads through `isPublic=true`
  and allows admins through `includeDisabled=true`.
- `src/app/dashboard/datasets/[datasetId]/page.tsx` redirects anonymous users to
  `/`, returns `notFound()` for inaccessible datasets, and loads private datasets
  for admins.
- `src/app/api/datasets/**/route.ts` returns `401` for anonymous requests,
  returns `404` for inaccessible datasets, and restricts mutations/admin-only
  operations with `jsonAdminOnlyError(...)`.
- `src/lib/saved-dataset-tables.ts` scopes saved tables to `ownerId` and joins
  only public datasets today.
- `supabase/migrations/20260421201702_add_dataset_public_visibility.sql`
  defines dataset and row read policies as `is_public or private.is_dataset_admin()`.
- `supabase/migrations/20260417052141_add_saved_dataset_tables.sql` defines saved
  table RLS by owner.
- `supabase/tests/database/001_public_security.test.sql` verifies anonymous users
  cannot read datasets, viewers can read public datasets but not hidden/private
  datasets, and admins can read hidden/private datasets.
- `tests/ui/route-registry.ts` already covers anonymous auth, viewer/admin
  dashboard routes, dataset detail routes, saved-table journey coverage, and
  viewer redirects from admin pages.

## Terminology

- **Admin-uploaded/default dataset:** a dataset record managed through admin
  dataset workflows and used as a shared application dataset.
- **Public dataset:** a dataset with `is_public=true`; authenticated viewers and
  admins can read it.
- **Private dataset:** a dataset with `is_public=false`; only authenticated
  admins can read it.
- **Derived dataset:** a dataset whose `backing_dataset_id` points to another
  dataset and whose rows/downloads resolve through that backing source.
- **User-saved dataset view/table:** an owner-scoped saved filter/sort view in
  `saved_dataset_tables`; it belongs to a user and does not become shared just
  because the owner is an admin.

## Proposed Behavior Contract

- Anonymous users cannot access dashboard dataset surfaces or dataset APIs.
  Browser pages redirect to the app's sign-in entry route; in the current app
  that route is `/` locally and on the deployed `data.accelerateglobal.org`
  host. JSON APIs return `401 Unauthorized`.
- Authenticated viewers can access public datasets, public dataset rows,
  public dataset downloads, and their own saved tables whose underlying dataset
  is accessible to them.
- Authenticated viewers cannot access private datasets, private dataset rows,
  private dataset downloads, dataset mutations, upload/replace/version actions,
  or admin-only dashboard pages.
- Authenticated admins can access public and private datasets, rows, downloads,
  edit pages, upload/replace flows, version history, and dataset mutations.
- Private physical datasets and private derived datasets use the same
  read/download access rules: viewers receive not found, while admins can read
  or download them.
- Missing datasets and datasets unauthorized for the current principal are not
  distinguishable to viewers through dataset pages or read APIs; both resolve as
  not found.
- Saved tables are always owner-scoped. A saved table may only be read, updated,
  deleted, opened, or downloaded when the requester owns it and can access the
  underlying dataset under the same dataset-access rules.
- Admin users may create and use their own saved tables for private datasets,
  but admin status does not grant access to another user's saved tables.
- Missing saved tables and saved tables inaccessible because of ownership or
  underlying dataset access return the same `404 Not Found` behavior across
  saved-table APIs.
- API status codes should be consistent: `401` for unauthenticated JSON API
  requests, `403` for authenticated non-admin attempts to perform admin-only
  actions, and `404` for missing or inaccessible read resources.

## Security And Privacy Considerations

- Private dataset existence, metadata, rows, and download URLs must not leak to
  anonymous users or authenticated viewers.
- RLS must remain enabled for `datasets`, `dataset_rows`, and
  `saved_dataset_tables`.
- Admin access must continue to depend on Supabase app metadata, not user-editable
  user metadata.
- Saved table ownership and dataset visibility must both be enforced so saved
  views cannot bypass dataset visibility changes.
- Supabase Storage downloads must only produce signed URLs after dataset access
  succeeds.

## User Impact

- Viewers get predictable access to public datasets and their own saved tables.
- Viewers see redirects or not-found responses instead of permission details for
  private or missing datasets.
- Admins can manage and inspect private datasets without changing viewer access.
- Future UI/API behavior changes have a shared contract for product review.

## Compatibility Notes

- The proposal is intended to preserve most current behavior while formalizing
  inconsistencies.
- Saved-table behavior requires implementation review where current code joins
  only public datasets even for admins.
- Any RLS changes would require Supabase migration and database security
  verification, but no migration is part of this proposal.

## Open Questions

- Should a future dedicated sign-in route replace `/` for browser redirects?
  Evidence: current dashboard pages redirect anonymous users to `/`, which is
  the deployed app's sign-in entry point today.

## Why

Authenticated dataset access is core product behavior and spans UI routes, JSON
APIs, saved-table flows, Supabase RLS, and smoke coverage. A focused OpenSpec
proposal provides a reviewable contract before implementation changes are made.

## What Changes

- Add the `authenticated-dataset-access` capability describing access behavior
  for anonymous users, authenticated viewers, and authenticated admins.
- Define page redirect/not-found behavior and API `401`/`403`/`404` behavior for
  dataset access.
- Define saved-table access as owner-scoped and constrained by underlying
  dataset access.
- Define verification expectations for direct tests, UI smoke, and DB security
  when implementation later changes app code or RLS.

## Capabilities

### New Capabilities

- `authenticated-dataset-access`: Access contract for authenticated dataset
  pages, dataset APIs, row APIs, downloads, saved tables, and dashboard flows.

### Modified Capabilities

- None. There are no existing OpenSpec baseline capabilities in `openspec/specs`.

## Impact

- Proposal/spec only in this change.
- Future implementation will likely touch dataset page routes, dataset API
  routes, saved-table APIs, direct route/lib tests, UI smoke coverage, and
  possibly Supabase RLS migrations if the final saved-table/private-dataset
  answer requires it.
