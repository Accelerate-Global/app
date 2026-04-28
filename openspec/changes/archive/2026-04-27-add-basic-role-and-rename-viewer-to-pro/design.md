## Context

Workspace roles currently live in Supabase `auth.users.raw_app_meta_data.workspace_role`, with `viewer` as the default non-admin role and `admin` as the elevated role. Dataset and saved-table access already use app-layer identity checks plus Supabase RLS as defense in depth. Profile name/email changes currently happen through the browser Supabase Auth client, so basic profile restrictions need both UI gating and database enforcement.

## Goals / Non-Goals

**Goals:**
- Make `pro` the canonical replacement for the current `viewer` role while accepting legacy `viewer` values as `pro`.
- Add `basic` as a lower role that can browse/filter/download public datasets but cannot edit profile/account data or create new saved tables.
- Preserve current `pro` and `admin` behavior except for the role rename.
- Keep saved-table ownership and underlying dataset access checks unchanged for read, update, delete, and download.
- Verify the role migration and permission restrictions through app tests, database security tests, and UI smoke.

**Non-Goals:**
- Do not rewrite historical analytics rows.
- Do not migrate users to `basic` automatically.
- Do not change private dataset visibility, admin dataset management, or first-admin bootstrap.

## Decisions

- Canonical roles are `admin`, `pro`, and `basic`. `viewer` is retained only as a legacy parse alias so existing sessions or un-migrated metadata behave as `pro` until refreshed.
- `CurrentIdentity` carries the resolved `workspaceRole` in addition to `isDatasetAdmin`. Role-specific guards use `workspaceRole`; admin-only checks keep using `isDatasetAdmin`.
- `basic` saved-table creation is blocked in both `/api/saved-tables` and the `saved_dataset_tables` insert RLS policy. Existing saved-table read/update/delete/download stays owner-scoped and dataset-access scoped.
- `basic` profile changes are blocked in UI, `/api/account/disable`, and a private Supabase trigger on `auth.users` updates. The trigger permits app metadata changes so admins/service code can promote or demote users.
- UI smoke adds explicit `basic` projects and keeps `pro` projects as the renamed standard-user path so route and journey coverage exercises both standard and lower-permission behavior.

## Risks / Trade-offs

- Existing `viewer` JWT claims may remain until session refresh -> parse `viewer` as `pro` everywhere while the migration updates stored metadata.
- Auth trigger on `auth.users` could block legitimate admin role changes if too broad -> restrict only email and `raw_user_meta_data` changes for users whose old or new app role is `basic`.
- UI smoke matrix grows with `basic` projects -> keep basic route coverage targeted to dashboard, dataset detail, profile, and admin redirects.
- Database verification requires local Supabase -> use repo policy to stop/reset repo-local Supabase if ports are blocked and clean Docker cache before finalizing.
