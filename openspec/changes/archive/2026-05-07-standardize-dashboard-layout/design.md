## Context

Dashboard pages currently render their own outer content containers with
`max-w-4xl`, `max-w-6xl`, or `max-w-7xl`, while `SiteHeader` uses a separate
`max-w-[1500px]`. Ordinary tables use `src/components/ui/table.tsx`; larger
dataset-style tables use the reui DataGrid table header layer.

## Goals / Non-Goals

**Goals:**
- Use one shared dashboard content shell for renderable authenticated dashboard
  pages.
- Align the site header with that same desktop width.
- Prevent selecting table headers without disabling body-cell text selection.

**Non-Goals:**
- No auth entry page, reset-password, or sign-up layout changes.
- No table sorting, resizing, dragging, or data behavior changes.
- No changes to route registry entries or page smoke markers.

## Decisions

- Use `max-w-7xl` as the dashboard desktop width because data-heavy pages
  already use it and narrower pages are the visible inconsistency.
- Add a shared shell component instead of duplicating the container class across
  pages. Keep a `gap` option so the dataset detail page can preserve its tighter
  vertical rhythm while sharing the same width.
- Add `select-none` to `<th>` rendering in both table systems, not to table
  bodies or rows.

## Risks / Trade-offs

- Narrow pages such as Profile will have a wider outer content column. Their
  inner form/card controls remain responsible for their own readable width.
- DataGrid headers also support drag and resize affordances; limiting the
  non-selection change to header cells preserves those existing interactions.
