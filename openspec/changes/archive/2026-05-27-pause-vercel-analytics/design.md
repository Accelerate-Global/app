## Context

The app mounts Vercel Web Analytics in the root layout and sends custom product
events through `trackAppEvent`. Those same product events are also persisted to
the internal Supabase-backed analytics store and surfaced on the admin
analytics page.

## Goals / Non-Goals

**Goals:**

- Provide a reversible environment flag that stops outbound Vercel Web
  Analytics page views and custom events.
- Keep all existing analytics call sites and internal analytics persistence
  active.
- Make the pause behavior deterministic in both browser and server helpers.

**Non-Goals:**

- Remove the `@vercel/analytics` dependency or Vercel dashboard integration.
- Change Supabase analytics tables, RLS, admin permissions, or analytics UI
  behavior.
- Toggle Vercel project settings automatically.

## Decisions

- Use `NEXT_PUBLIC_VERCEL_ANALYTICS_PAUSED=1` as the only paused value. This
  keeps unset environments active by default and gives browser code a public
  env value that Next can inline at build time.
- Centralize the flag in `src/lib/analytics.ts` so the component and event
  helpers share the same interpretation.
- Gate only outbound Vercel calls. The internal `/api/analytics/events`
  persistence path remains active so `/dashboard/analytics` continues to
  receive product events while Vercel collection is paused.
- Keep the server helper aligned with the browser helper even though it has no
  current callers, avoiding a future mismatch if server-side analytics are
  introduced.

## Risks / Trade-offs

- Public env values are build-time browser configuration on Vercel. Changing
  the pause flag requires redeploying affected environments.
- Paused mode removes Vercel dashboard page views and custom-event reporting,
  so first-party analytics is the source of truth during the pause.
- If the Vercel dashboard remains enabled, historical analytics remain visible,
  but this app will stop sending new events while paused.
