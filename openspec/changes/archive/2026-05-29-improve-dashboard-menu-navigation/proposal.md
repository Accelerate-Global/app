## Why

Dashboard pages opened from the account menu currently feel slow because each
navigation waits for dynamic server rendering before the visible page changes.
The build confirms `/dashboard/**` routes are request-rendered, and the current
code repeats Supabase identity resolution and header rendering across pages.

## What Changes

- Preserve existing authenticated dashboard URLs, page content, admin redirects,
  and smoke coverage while making account-menu navigation visibly respond
  immediately.
- Add a shared authenticated dashboard layout that keeps the site header and
  account menu mounted across dashboard route transitions.
- Add a dashboard loading boundary so route changes can show stable skeleton
  feedback while page data resolves.
- Convert account-menu navigation rows to link-based in-app navigation with
  destination-scoped prefetching instead of click-only `router.push` handlers.
- Reduce duplicate Supabase auth work during page rendering without weakening
  existing admin permission and mutation checks.

## Capabilities

### New Capabilities

### Modified Capabilities
- `dashboard-layout`: dashboard navigation must keep the shared header stable
  and provide immediate loading feedback during authenticated dashboard route
  transitions.

## Impact

- Affects dashboard App Router pages under `src/app/dashboard/**`, the shared
  header/account menu, and server-side auth helpers under `src/lib/auth.ts` and
  `src/lib/supabase/proxy.ts`.
- Affects auth and Supabase request handling, but does not change database
  schema, RLS policy, public API payloads, admin role definitions, Vercel paid
  services, or deployment topology.
- Affects UI smoke-tracked pages; existing `data-smoke-page` and
  `data-smoke-page-ready` contracts must remain literal in each page file.
