## Context

`DatasetPartnerExports` currently renders an expanded card before the main exploration controls and fetches profiles as soon as the dataset page mounts. `DatasetDetailClient` renders the desktop Filters panel in a `22rem` left column but places `DatasetTableActionBar` above the table in the wider right column. `DatasetCountryMap` and `DatasetMapView` duplicate literal teal/slate colors across Leaflet feature styles, the legend, focused records, and the map canvas even though `src/app/globals.css` already defines the effective light/dark AX palette.

The change is client-side presentation work. Existing partner-export APIs, admin authorization, canonical filtering, table/map row parity, bundled map assets, and profile editor behavior remain authoritative.

## Goals / Non-Goals

**Goals:**

- Reduce the page-level Partner exports footprint to one clear administrator action.
- Preserve export context and history in a first-stage management sheet, then hand off to the existing wide profile editor.
- Put filtered-table context immediately above the controls that change it and keep all actions usable in the narrow desktop column.
- Make the map count ramp and interaction states use one semantic token source that responds automatically to effective light/dark appearance.
- Preserve keyboard behavior, accessible names, same-origin map operation, and smoke coverage.

**Non-Goals:**

- Changing partner export schemas, validation, generation, polling, downloads, or authorization.
- Changing filter semantics, saved-table behavior, table/map parity, map counts, ISO3 matching, geometry, or selection meaning.
- Adding a theme-specific JavaScript store, hosted map service, external tiles, new dependency, database migration, Supabase work, or Vercel configuration.

## Decisions

1. **Use a compact export trigger plus two sequential sheets.** `DatasetPartnerExports` will render one `Partner exports` button. Opening it will reveal a management sheet with the existing description, loading/error state, profile cards, previews, runs, and `New export profile` action. Starting or editing a profile will close the management sheet before opening the existing two-thirds-width profile editor; closing or successfully saving the editor will return to the management sheet. Keeping only one modal surface active avoids stacked focus traps while preserving the editor's proven width and controls. A single always-wide sheet was rejected because the overview does not need editor-scale width; keeping the expanded card was rejected because it does not meet the requested hierarchy.

2. **Load export detail on first management-sheet open.** The trigger itself needs no server data. Profiles and runs will be fetched when the admin first opens the management sheet, then refreshed after profile mutations and run activity. This removes an invisible page-load request while keeping the current API and error behavior. Eager loading was rejected because the details are no longer visible on initial page render.

3. **Place one action-bar instance with CSS grid positioning.** `DatasetDetailClient` will render `DatasetTableActionBar` once before the filter aside and use desktop grid coordinates to place it in column one, row one; Filters will occupy column one, row two; the Table/Map content will span both rows in column two. Below the desktop breakpoint, the filter aside remains hidden, so the same action bar naturally becomes the full-width first item and retains its Filters-sheet trigger. Rendering separate desktop/mobile instances was rejected because duplicated save/download state and duplicate accessible controls would be error-prone.

4. **Give the action bar an intentionally compact composition.** Its count label will use the current typography at a reduced narrow-column scale, and actions will use a two-column grid with full-width buttons. The longer `Assign to dataset` action can span both columns; role-based omissions collapse naturally. This preserves every action without overflow or truncated labels.

5. **Define semantic dataset-map color aliases from core AX tokens.** `src/app/globals.css` will define `--dataset-map-canvas`, `--dataset-map-empty`, four ordered count-ramp colors, `--dataset-map-boundary`, `--dataset-map-selected`, and `--dataset-map-focus` from `--background`, `--foreground`, `--muted`, `--accent`, and `--ring` using CSS `color-mix()` where intermediate intensity steps are needed. The variables inherit the existing `.dark` token overrides, so the browser updates rendered SVG styles when appearance changes without map teardown or React theme state.

6. **Share the same semantic ramp between Leaflet and the legend.** `DatasetCountryMap` will export the ordered count-fill token references used by `getCountryFeatureStyle`; `DatasetMapView` will render its legend from that same order. Map-focused callouts, selected record rows, temporary table-scope feedback, and the canvas will use semantic Tailwind or dataset-map tokens instead of teal/slate literals. Tests will assert semantic token use and preserved intensity/selection separation rather than hard-coded hex values.

7. **Add explicit smoke coverage for the new first-stage sheet.** The page button, management sheet, and existing profile editor will expose separate literal `data-smoke-trigger`, `data-smoke-surface`, and `data-smoke-ready` values. The administrator journey will open the management sheet before beginning a new profile and will verify sequential close/open behavior. Existing dataset-detail page registration remains unchanged.

## Risks / Trade-offs

- **[Risk] Sequential sheets could lose the admin's place.** → Preserve loaded profiles, previews, errors, and draft state in the owning component and return to the management sheet after editor exit.
- **[Risk] Lazy loading can make the first sheet open feel empty.** → Open immediately with the existing loading indicator and only mark the sheet smoke-ready when its stable shell is rendered; data completion remains separately observable.
- **[Risk] Narrow action labels could wrap.** → Use full-width grid buttons and allow the long action to span both columns; verify at the existing desktop sidebar width and a phone viewport.
- **[Risk] CSS color expressions may drift between the map and legend.** → Export one ordered token list and use it in both places; keep direct tests for each intensity bucket.
- **[Risk] An inherited CSS variable may not prompt a Leaflet redraw.** → Store `var(--dataset-map-...)` references directly in SVG presentation attributes so browser style recomputation handles appearance changes; browser smoke verifies the computed fills before and after an appearance change.
- **[Risk] Shared smoke files already contain unrelated work.** → Make narrow additive edits and review the final diff by owned path without overwriting existing changes.

## Migration Plan

Implement the component and token changes without data migration, run direct Vitest coverage, `smoke:check`, and the repo-selected terminal verification gate, then ship through the existing PR workflow. Rollback is the prior UI commit; no API, storage, database, Supabase, or persisted-state recovery is required.

## Open Questions

None. The plan uses `Partner exports` as the single page button label and keeps the current profile editor as the second stage.
