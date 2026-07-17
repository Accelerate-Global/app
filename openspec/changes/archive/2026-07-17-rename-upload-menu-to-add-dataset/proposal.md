## Why

The administrator account menu still labels the dataset-creation entry as `Upload`, while the rest of the product now uses `Add Dataset` for that outcome. Aligning the menu label removes outdated terminology without changing the established route or workflow.

## What Changes

- Rename the administrator account-menu item from `Upload` to `Add Dataset`.
- Keep its existing `/dashboard/upload` destination, upload icon, admin-only visibility, redirects, replacement behavior, and onboarding behavior unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard-layout`: Define the administrator account-menu label for the existing upload compatibility route.

## Impact

- UI and direct test: `src/components/auth/account-control.tsx` and `src/components/auth/account-control.test.tsx`.
- Durable behavior: `openspec/specs/dashboard-layout/spec.md` receives the archived delta.
- Existing smoke triggers, route registry entries, auth/admin permissions, data integrity, Supabase, Vercel configuration, and API contracts are unchanged.
