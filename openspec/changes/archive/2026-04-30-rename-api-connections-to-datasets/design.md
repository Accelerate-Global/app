## Context

`/dashboard/api-connections` is currently an admin-only operational surface backed by existing API connection records and code-managed definitions. Its durable spec currently describes the index as searchable/filterable and its UI shows a page heading, menu label, search box, classification filter, status filter, and status column that no longer match the desired scan-first Datasets presentation.

## Goals / Non-Goals

**Goals:**

- Rename visible admin navigation and page copy so the surface reads as `Datasets`.
- Simplify the index card to show all connections without search/filter controls.
- Remove status from the index table while leaving detail-page run status and history behavior intact.
- Keep UI smoke markers, smoke route IDs, and existing route/API paths stable.

**Non-Goals:**

- No route migration away from `/dashboard/api-connections`.
- No API endpoint, type, database, Supabase RLS, auth metadata, or Vercel runtime change.
- No change to connection detail run operations, run status badges, or ingestion history.

## Decisions

- Keep route and code identifiers unchanged. This avoids a larger compatibility and smoke registry migration while satisfying the visible UI rename.
- Remove index filtering state instead of hiding controls with CSS. This keeps the client component simpler and prevents stale filtered empty-state behavior.
- Continue using existing admin authorization and smoke markers. The change does not introduce new permissions, external services, or browser surfaces.
- Update tests at the same-stem component/page boundaries so removed controls and renamed copy are covered directly.

## Risks / Trade-offs

- Users can no longer narrow the index by search, classification, or status from this page -> Mitigated by the current short code-managed connection list and preserved detail-page drill-in.
- The visible label `Datasets` shares terminology with the existing `/dashboard/datasets` surface -> Mitigated by keeping routes stable and using `Connections` as the index card title inside the admin operational page.
- Browser smoke may still identify the route as `api-connections` internally -> Mitigated by keeping `data-smoke-page="api-connections"` and route registry entries unchanged.
