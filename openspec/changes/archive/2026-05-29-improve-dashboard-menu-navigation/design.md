## Context

Dashboard routes are dynamic because authenticated pages depend on Supabase
session cookies and role metadata. Today each dashboard page renders its own
`SiteHeader`, and account-menu items are click handlers that call
`router.push`, so hidden menu destinations are not link-addressable until the
click path runs. Supabase identity is also resolved in both the proxy/session
refresh path and the page/API helper path.

The change is constrained by Vercel Hobby/free usage, existing UI smoke
contracts, and the current Supabase security model where admin capability comes
from trusted app metadata.

## Goals / Non-Goals

**Goals:**
- Make dashboard route transitions from the account menu visibly immediate.
- Keep the header/account menu stable across dashboard page changes.
- Reduce duplicate auth work in page rendering while preserving existing
  permission outcomes.
- Keep all smoke page markers literal and maintain the existing route registry.
- Avoid paid Vercel features, remote caches, or broad prefetch fan-out.

**Non-Goals:**
- No database schema, RLS, storage, or public API contract changes.
- No changes to workspace role definitions, admin-only redirects, or sign-out
  behavior.
- No Vercel region, plan, or deployment workflow change.

## Decisions

- Use a shared `src/app/dashboard/layout.tsx` for the authenticated dashboard
  frame. This keeps the `SiteHeader` and `AccountControl` mounted while child
  dashboard routes change, reducing repeated rendered payload and making the
  header feel stable.
- Keep per-page smoke markers in each `page.tsx`. The shared layout owns the
  dashboard frame, but each route remains responsible for its literal
  `data-smoke-page` and `data-smoke-page-ready` markers.
- Add `src/app/dashboard/loading.tsx` with existing skeleton primitives. This
  gives App Router a segment loading boundary for immediate feedback during
  dynamic dashboard navigations.
- Convert account-menu navigation rows to Next links. Links preserve accessible
  hrefs and App Router navigation behavior; destination-scoped hover/focus
  prefetch avoids prefetching every admin route when the menu opens.
- Preserve current auth freshness for sensitive operations. The proxy remains
  the centralized session refresh boundary, and page helpers can consume
  proxy-verified identity data instead of repeating the same auth lookup during
  the same request.

## Risks / Trade-offs

- Shared layout changes affect many dashboard page tests -> update focused page
  tests and run targeted UI smoke.
- Internal identity headers could be spoofed if not sanitized -> strip/overwrite
  internal auth headers inside the proxy before forwarding a request.
- Loading UI can make smoke pass before content is usable -> keep
  `data-smoke-page-ready` on loaded page content, not only the loading fallback.
- Auth/proxy edits impact DB/security verification selection -> run the local
  database security gate and clean up any Supabase/Docker services it starts.
