## Context

The same admin capability is currently exposed with three different names: the account menu says `Datasets`, the index page says `Data sources`, and its creation link says `Add dataset`. The index client also renders a second `Reference resources` card even though the primary job of the route is operating connections. The current creation route already accepts `?source=google-sheets`, so the Connections page can enter the existing provider-specific flow without introducing a new route or duplicating connection logic.

## Goals / Non-Goals

**Goals:**

- Use `Connections` consistently in admin navigation, the index heading, detail back-navigation, and onboarding cross-links.
- Use `Add connection` for the Connections index action and for the Google Sheets deep-linked page heading.
- Remove the reference-resources card and its client-side code from the index.
- Preserve existing route markers, authorization, connection execution, and dataset import behavior.

**Non-Goals:**

- Renaming `/dashboard/api-connections`, API endpoints, database tables, TypeScript API types, or the general dataset domain.
- Removing captured-resource persistence or built-in resource routes.
- Renaming the general `/dashboard/datasets/new` experience when it is opened without the Google Sheets deep link or for CSV upload.
- Changing Supabase RLS, auth metadata, Vercel runtime behavior, or deployment configuration.

## Decisions

1. Keep the existing routes and internal connection names. Visible terminology is the requested change; changing stable URLs and API identifiers would create migration and compatibility cost without improving the user-facing result. The alternative was a new `/dashboard/connections` route with redirects, but that is unnecessary because the current URL already describes API connections.
2. Link `Add connection` to `/dashboard/datasets/new?source=google-sheets`. This reuses the tested Google Sheets service-account workflow and skips the unrelated source chooser. The onboarding page derives its heading and introduction from the validated `source` parameter so direct Google Sheets entry says `Add connection`, while default and CSV entry retain `Add dataset`.
3. Remove the resources UI at the client boundary. The page stops passing resources into the client, and the client removes the resource-specific prop, constants, icon, table, navigation, and empty state. Persistence and server return types remain compatible for connection detail/history and future non-index consumers.
4. Update directly mapped tests and durable OpenSpec scenarios alongside product code. Existing literal smoke page markers and route registry entries remain valid; `smoke:check` will confirm the contract.

## Risks / Trade-offs

- [Risk] `Add connection` could be confused with CSV upload if it opens the generic chooser. → Mitigation: deep-link directly to `source=google-sheets` and render provider-specific page copy.
- [Risk] Stale labels could remain in secondary navigation or tests. → Mitigation: search the owned UI paths for `Datasets`, `Data sources`, and `Add dataset`, then cover menu, index, detail, and onboarding labels in direct tests.
- [Risk] Removing the card could accidentally remove resource ingestion. → Mitigation: limit the change to index rendering and props; leave database schema, run parsing, persistence, and APIs untouched.
- [Risk] A route rename could invalidate bookmarks or smoke registration. → Mitigation: keep `/dashboard/api-connections` and all existing smoke identifiers unchanged.

## Migration Plan

Deploy as a normal UI-only application change. No data or infrastructure migration is required. Rollback is a source revert of the labels, deep link, and resources card because all backing data and routes remain unchanged.

## Open Questions

None.
