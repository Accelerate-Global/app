## Context

`ApiConnectionDetailClient` currently renders two `CollapsibleRunCard`
instances: one for selected-run content and one for the DataGrid. Row selection
already updates `selectedRunId` and TanStack row-selection state, while the
detail body already contains every diagnostic the requested sheet needs. The
dashboard also has an established right-side `Sheet` pattern and literal UI
smoke markers on sheet triggers and surfaces.

The Connections index title is owned by `ApiConnectionsClient`, not the route's
top-level `Connections` heading. This change therefore stays within two client
components, their tests, and UI smoke metadata/journey coverage.

## Goals / Non-Goals

**Goals:**

- Present one always-visible `Run history` card instead of two diagnostic cards.
- Open a right-side run-detail sheet only when an admin selects a table row.
- Preserve selected-row highlighting, sorting, five-row viewport behavior,
  artifact links, polling, and refresh behavior.
- Use existing Sheet and DataGrid patterns with accessible labels and matching
  smoke trigger/surface/ready markers.
- Rename only the index card title to `Dataset sources`.

**Non-Goals:**

- Changing API responses, stored run data, authorization, run execution, or
  polling cadence.
- Opening run details automatically after a test/import action.
- Changing the top-level `Connections` heading, source status, or Resources card.
- Introducing a new shared UI primitive or database migration.

## Decisions

- Replace `CollapsibleRunCard` with a normal Card for the DataGrid. The history
  is the primary content at the bottom of the page and no longer needs a second
  interaction before a row can be selected.
- Render the existing detail JSX in the standard controlled right-side `Sheet`.
  This reuses the established dashboard overlay, focus management, close button,
  and responsive behavior instead of creating a custom drawer.
- Keep `selectedRunId` and TanStack `rowSelection` as the single selection state.
  A dedicated row-click handler selects the row and opens the sheet; background
  run creation may select a run but does not open the sheet.
- Attach `data-smoke-trigger="api-connection-run-detail-sheet"` to a rendered
  run cell so the marker exists only when a selectable row exists, with matching
  surface/ready markers on the Sheet. Add one admin smoke journey that stubs a
  completed test run, selects its row, and verifies the sheet.
- Keep the sheet in the same client component because its data is already local
  and live polling updates the selected run through the existing `runs` state.

## Risks / Trade-offs

- [A wide diagnostic body can feel cramped in a side sheet] -> Use a full-width
  mobile sheet and a wider desktop maximum with independently scrollable content.
- [Artifact links inside a row could open the sheet unintentionally] -> Preserve
  the existing event propagation stop around artifact actions.
- [Selection can remain after the sheet closes] -> Keep the highlight as useful
  context; reopening another row replaces it.
- [Smoke test could trigger a real provider run] -> Stub the run endpoint with a
  complete successful run response before clicking the existing test action.

## Migration Plan

Deploy as an application-only UI change through the normal PR/Vercel workflow.
No Supabase migration, RLS change, or local database reset is required for the
implementation; the standard UI smoke harness may start its isolated local
Supabase stack. Rollback is a normal application revert.

## Open Questions

None.
