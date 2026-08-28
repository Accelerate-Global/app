## Context

The dataset detail page currently renders `DatasetPartnerExports` in the page shell, renders `DatasetTableActionBar` and `DatasetViewSwitchGrid` as separate left-column cards, and owns the Table/Map switch inside `DatasetDetailClient` above the right-column content. `DatasetTable` uses a fixed 560px scroll viewport and local data-grid class overrides. The current role checks are correctly centralized at the server page: `identity.isDatasetAdmin` controls Partner exports and whether assignable datasets are passed to the client.

This is a presentation change across several existing React components. It does not change the canonical filter pipeline, the partner-export APIs, saved-table persistence, Supabase RLS, auth metadata, Vercel runtime behavior, or any database schema.

## Goals / Non-Goals

**Goals:**

- Build one compact dataset toolbar that keeps the Table/Map control adjacent to Partner exports when the admin action is present.
- Render the filtered-table summary/actions and desktop filters inside one shared soft card.
- Let the right-column table viewport visually align with the combined left card at the desktop breakpoint while retaining practical fixed-height scrolling.
- Use semantic AX surface tokens so the table matches the surrounding soft cards in light and dark modes.
- Preserve the existing narrow-screen Filters sheet and role-gated actions.

**Non-Goals:**

- Changing who can assign datasets or use Partner exports.
- Changing filter state, map state, row virtualization, sorting, CSV output, saved tables, or export profiles.
- Introducing viewport measurement, third-party layout dependencies, database changes, or new routes.

## Decisions

1. **Move the view switch to a page-level toolbar slot owned by the dataset client.** The server page will keep rendering the admin-only export action, while a small shared toolbar arrangement will allow the client-owned Table/Map state to remain in `DatasetDetailClient`. The export trigger and view switch will share a flex row at the page level without moving permission logic into the client. Passing the export trigger through a client slot or composing a new client toolbar at the page boundary avoids duplicating the role check. An alternative of making Partner exports render for every role and hiding it in CSS was rejected because permission-based rendering must remain server-controlled.

2. **Compose the summary and memoized filter grid inside one shared surface.** `DatasetDetailClient` will render `DatasetTableActionBar` and `DatasetViewSwitchGrid` as siblings inside one border, background, and shadow, with the filter grid visually embedded through its existing class override. On narrow screens the filter-grid sibling is hidden while the same action-bar instance remains visible and opens the existing Filters sheet. This preserves the filter rail's memoization when only table sorting changes. An alternative of passing the changing action bar through the memoized filter grid was rejected because it would rerender the full filter rail during sorting.

3. **Use a desktop-specific table viewport height matched to the stable collapsed filter card.** The combined sidebar has a predictable default height because filter sections initialize collapsed. `DatasetTable` will use a larger desktop height token and retain the existing height below the desktop breakpoint. Expanded filter sections may extend beyond the table, which is acceptable because the sidebar remains independently scrollable through the page. Runtime DOM measurement was rejected because it would couple virtualizer sizing to filter animations and add resize synchronization complexity.

4. **Override the dataset grid through its existing local class-name contract.** `DatasetTable` will provide semantic `bg-card`/muted-opacity classes for the container, sticky header, body rows, and pinned cells rather than changing shared data-grid defaults used elsewhere. This keeps the change scoped and allows AX light/dark CSS variables to respond automatically. Changing the shared primitive was rejected because other administrative tables may depend on its current contrast.

5. **Keep the existing smoke surfaces and add stable layout markers only where browser assertions need them.** No new sheet, dialog, menu, tooltip, popover, page, or shared UI primitive is introduced. Existing smoke triggers for Partner exports, map, filters, and assignment remain valid.

## Risks / Trade-offs

- **[Risk] The exact table/sidebar heights can drift as copy or actions change.** → Use a named desktop height constant/class covered by component and browser assertions; keep overflow within the table rather than clipping page content.
- **[Risk] Moving controls across the server/client boundary could weaken admin gating.** → Keep `identity.isDatasetAdmin` as the sole condition that constructs the Partner exports element and test both admin and non-admin page renders.
- **[Risk] Softening every row may reduce separation.** → Preserve borders, hover, selection, and sticky-header contrast while changing only semantic surface fills.
- **[Risk] Combining cards may reduce clarity on narrow screens.** → Combine only at the desktop sidebar breakpoint and retain the existing standalone action card plus filter sheet on narrower widths.

## Migration Plan

Deploy as a normal frontend release with no data migration. Rollback is a single application revert restoring the previous component composition and local table classes.

## Open Questions

None.
