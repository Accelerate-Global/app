## Context

`ApiConnectionDetailClient` renders provider-agnostic status and history cards, plus an always-visible Google Sheets-only source card. The source card contains useful but secondary configuration and maintenance controls. The same component already uses the shared right-side `Sheet` primitive for run diagnostics, so the interaction pattern and accessibility behavior are established in this surface.

## Goals / Non-Goals

**Goals:**

- Align Google Sheets connection details with the visual hierarchy of other providers.
- Keep every existing source setting and action available without navigating away.
- Give the source settings sheet explicit UI-smoke affordances and direct tests.
- Preserve existing client state, request handlers, permissions, and API calls.

**Non-Goals:**

- Relocate Google Sheets settings to a separate route or global settings area.
- Change onboarding, header-selection semantics, workflow assignments, access checks, disconnect behavior, or provider APIs.
- Change the existing run-detail sheet.

## Decisions

1. **Use one header-level trigger and a right-side sheet.** The `Google Sheets source` button will sit above the primary content cards and open a wide, vertically scrollable `Sheet`. This keeps source identity discoverable while allowing `Source status` to lead the content flow. A collapsible card was considered, but it would continue to occupy page space and make the page structure provider-specific.

2. **Move the existing source UI as one functional unit.** Metadata, links, service-account email, workflow controls, header review, access check, and disconnect confirmation remain together inside the sheet and continue using existing state and handlers. Splitting settings across surfaces was rejected because these controls share context and maintenance workflows.

3. **Reuse the shared Sheet primitive.** No new UI primitive or dependency is introduced. The content width will be expanded for the workflow form while remaining responsive, and its body will scroll independently so long configurations remain usable.

4. **Add literal smoke markers at the interaction boundary.** The trigger exposes `data-smoke-trigger="google-sheets-source"`; the sheet exposes matching `data-smoke-surface` and `data-smoke-ready`; the close control exposes a matching close marker. Browser coverage will open the sheet before using source actions.

5. **No local Supabase stack is required.** This is a client presentation change backed by existing mocked component tests and existing browser bootstrap data. Supabase RLS, auth metadata, Vercel runtime behavior, and database state are unaffected.

## Risks / Trade-offs

- [Long workflow configuration can exceed the viewport] → Use a wide sheet with a dedicated vertical scroll region.
- [Existing tests and smoke journeys assume source actions are immediately visible] → Update them to open the source sheet first and assert the new surface.
- [Two right-side sheets exist in the same component] → They are opened by distinct user actions and retain separate state; tests cover each entry point.
- [Secondary controls become one click deeper] → Keep the trigger prominent and specifically labeled with the provider name.

## Migration Plan

Deploy as a presentation-only client update with no data migration. Rollback is the inverse JSX change; existing stored connections and workflows remain compatible.

## Open Questions

None.
