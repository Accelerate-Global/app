## Why

Dataset visibility is currently expressed only through an admin edit control, so an admin browsing the dashboard cannot tell that a listed dataset is hidden from non-admin users. The existing visibility state and dataset tag list need one durable invariant so restricted datasets are unmistakable wherever tags are rendered.

## What Changes

- Reserve a red `Private` dataset tag that is controlled by workspace visibility instead of freeform tag editing.
- Automatically add the `Private` tag whenever a dataset is hidden from non-admin users and automatically remove it whenever the dataset becomes workspace-visible.
- Enforce the visibility/tag invariant in the dataset mutation layer, not only in the edit form, and backfill existing hidden datasets.
- Show the linked `Private` tag immediately in the admin edit form and in dashboard dataset rows.
- Prevent `Private` from being manually created, reused, edited, or removed as an ordinary dataset tag.
- Preserve existing dataset access rules, admin permissions, classification tags, and non-visibility tags.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `authenticated-dataset-access`: Restricted dataset metadata must carry a system-managed `Private` tag synchronized with workspace visibility.
- `dashboard-layout`: Admin dataset rows and edit controls must visibly expose the linked `Private` tag for hidden datasets.

## Impact

- Dataset tag normalization and validation in `src/lib/dataset-tags.ts` and `src/lib/datasets.ts`.
- Dataset editing behavior in `src/components/dashboard/dataset-edit-page-client.tsx` and dashboard tag rendering through `src/components/dashboard/datasets-grid.tsx`.
- A Supabase migration under `supabase/migrations/` to backfill existing restricted datasets and enforce the data-integrity invariant for database writes.
- Unit, component, database-security, and targeted UI smoke coverage for the visibility/tag linkage.
- API response shape is unchanged (`DatasetTag[]`), but the tag collection for restricted datasets gains a reserved `Private` entry.
- Auth and admin authorization boundaries are unchanged. Supabase data integrity is affected; Vercel deployment behavior is not. Existing smoke-covered surfaces are extended without adding a route or shared UI primitive.
