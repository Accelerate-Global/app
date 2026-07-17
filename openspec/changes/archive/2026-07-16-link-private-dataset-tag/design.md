## Context

Dataset visibility is stored in `public.datasets.is_workspace_visible`; tag metadata is stored independently in the `datasets.tags` JSONB array. The admin edit client currently sends both fields, while `src/lib/datasets.ts` validates classification tags and persists optional metadata updates. Dashboard rows already render every tag they receive. Existing restricted datasets therefore need a data backfill, and future application or direct database writes need a single invariant that cannot drift.

The change touches React form behavior, shared tag-domain helpers, the server mutation layer, and Supabase data integrity. It does not alter RLS: authenticated non-admin users still cannot read restricted dataset metadata, while admins can.

## Goals / Non-Goals

**Goals:**

- Represent every restricted dataset with one canonical red `Private` tag.
- Remove the canonical or legacy case-insensitive `Private` tag when the dataset becomes workspace-visible.
- Make the linked state visible immediately while an admin toggles the edit control.
- Keep `Private` outside freeform and reusable tag workflows.
- Backfill current restricted rows and enforce the invariant for app and database writers.
- Cover domain helpers, form payloads, dashboard rendering, migration behavior, and smoke-visible UI.

**Non-Goals:**

- Changing which roles can read or manage datasets.
- Replacing the `is_workspace_visible` access-control field with tags.
- Adding custom tag colors or changing PGAC/PGIC classification behavior.
- Showing restricted datasets to non-admin users merely so they can see a `Private` tag.
- Adding a new route, shared UI primitive, or Vercel-specific runtime behavior.

## Decisions

### Reserve one canonical tag identity

The application will define a canonical `Private` tag with a stable reserved ID, exact label, and red hex color. Tag helpers will identify the reserved label case-insensitively, strip duplicate or spoofed variants, and compose exactly one canonical tag based on visibility.

This is preferable to treating `Private` as an ordinary saved tag because users could otherwise recolor, rename, duplicate, or detach it from the access-control state. It is also preferable to rendering a synthetic badge only in the dashboard because APIs, other tag renderers, and stored metadata would continue to disagree.

### Enforce the invariant at both domain and database boundaries

`src/lib/datasets.ts` will compose tags using the effective visibility for every metadata update, including visibility-only requests. A Supabase `BEFORE INSERT OR UPDATE OF tags, is_workspace_visible` trigger will independently canonicalize the JSONB value. The trigger covers SQL, Supabase, and future writers that bypass the Next.js mutation function; the TypeScript helper provides deterministic behavior and focused unit coverage before the database round trip.

The migration trigger will be named to execute after the existing visibility-alias synchronization trigger so writes through the deprecated `is_public` field are resolved before tag composition.

### Keep classification and system tags orthogonal

Classification helpers will continue to manage PGAC/PGIC. New system-tag helpers will filter `Private` separately, and freeform-tag helpers used by the editor and reusable-tag list will exclude both classification and system tags where appropriate. Derived datasets may carry `Private`; the restriction on PGAC/PGIC for derived datasets remains unchanged.

### Give immediate, non-editable UI feedback

When the visibility switch is off, the edit form will render the canonical red `Private` tag in the Tags section with explanatory system-managed text. It will not render through `DatasetTagEditor`, so there is no remove or edit control. The save payload will be composed from effective visibility, while server and database enforcement remain authoritative.

Dashboard rows require no alternate badge component: once summaries carry the canonical tag, the existing `DatasetTagList` renders it consistently alongside classification and user tags.

## Risks / Trade-offs

- [Trigger ordering with the deprecated visibility alias] → Use a trigger name that sorts after `datasets_sync_workspace_visibility` and test legacy-field updates in the database suite.
- [Existing user-created tags named Private] → Canonicalize all case-insensitive matches into the reserved red tag for restricted datasets and remove them for workspace-visible datasets; document the label as reserved.
- [App/database duplication] → Keep one small deterministic TypeScript composer and mirror its simple JSONB operation in SQL; test both boundaries against the same observable invariant.
- [Tag count limit] → The reserved tag consumes one stored tag slot. Validation continues to cap incoming user data, while composition deduplicates `Private` before adding the canonical entry.
- [Migration rollback leaves canonical tags] → Dropping the trigger alone is safe but leaves harmless metadata. A rollback may remove only reserved-ID/case-insensitive `Private` entries if full reversal is required; access control remains governed by `is_workspace_visible` throughout.

## Migration Plan

1. Add the private-tag trigger function and trigger.
2. Force an update of existing dataset rows so the trigger backfills restricted rows and removes reserved-label drift from visible rows.
3. Deploy application helpers and UI behavior; both old and new app versions remain compatible with the unchanged tag-array API shape.
4. Verify with a clean local Supabase database, including direct visibility changes and legacy alias synchronization.

Rollback can remove the new trigger/function and deploy the prior application. No access-control rollback is needed because RLS continues to use `is_workspace_visible` rather than tags.

## Open Questions

None. The screenshots and request establish the label, red treatment, and bidirectional linkage with the existing visibility control.
