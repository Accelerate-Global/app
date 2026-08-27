## 1. Reconfirm Scope and Verification Lane

- [x] 1.1 Rerun `pnpm run verify:change` and `pnpm run task:kickoff -- --scope 'src/components/dashboard/dataset-partner-exports*' --scope 'src/components/dashboard/dataset-detail-client*' --scope 'src/components/dashboard/dataset-table-action-bar*' --scope 'src/components/dashboard/dataset-country-map*' --scope 'src/components/dashboard/dataset-map-view*' --scope 'src/app/globals.css' --scope 'tests/ui/10-journeys.spec.ts' --scope 'tests/ui/route-registry.ts' --scope 'openspec/changes/refine-dataset-exploration-controls/**'` immediately before implementation, preserving unrelated worktree changes.
- [x] 1.2 Record the current required commands, targeted smoke subset, and local Supabase need from the refreshed planning output before editing code.

## 2. Compact Partner Export Entry Flow

- [x] 2.1 Refactor `DatasetPartnerExports` to render one administrator page button and lazy-load its profile/run details when the export-management sheet first opens.
- [x] 2.2 Move the existing explanation, error/loading states, profile cards, preview controls, run history, and downloads into a smoke-covered export-management sheet without changing API endpoints or export behavior.
- [x] 2.3 Implement sequential handoff between the management sheet and existing wide profile editor so only one modal surface is active and editor close/save returns to management.
- [x] 2.4 Update `dataset-partner-exports.test.tsx` for the compact initial state, lazy detail loading, both smoke surfaces, sequential focus flow, and preserved preview/generation/download behavior.

## 3. Filtered-Table Summary and Filter Layout

- [x] 3.1 Reorder the single `DatasetTableActionBar` instance in `DatasetDetailClient` so desktop grid placement puts it above Filters in the left column while Table/Map content spans the right column.
- [x] 3.2 Restyle `DatasetTableActionBar` with narrow-column typography and a full-width two-column action grid that handles role-based Download, Save, Assign, and mobile Filters actions without overflow or empty gaps.
- [x] 3.3 Update `dataset-detail-client.test.tsx` and `dataset-table-action-bar.test.tsx` to assert DOM order, one action-bar instance, compact action composition, mobile Filters access, and existing role-based action rules.

## 4. Appearance-Aware Map Palette

- [x] 4.1 Add semantic dataset-map CSS variables derived from the existing AX background, foreground, muted, accent, border/ring tokens so they inherit light and dark appearance changes.
- [x] 4.2 Replace literal teal/slate values in `DatasetCountryMap` with the semantic canvas, empty, intensity, boundary, selection, and focus tokens; export one ordered intensity ramp for reuse.
- [x] 4.3 Render the `DatasetMapView` legend from the shared ramp and replace map-focused callouts, selected record feedback, and temporary map table-scope styling with semantic design-system colors.
- [x] 4.4 Extend `dataset-country-map.test.ts`, `dataset-map-view.test.tsx`, and `dataset-detail-client.test.tsx` to verify intensity buckets, selection semantics, shared legend colors, removal of hard-coded teal/slate values, and state preservation across effective appearance changes.

## 5. UI Smoke Coverage

- [x] 5.1 Add literal smoke trigger/surface/ready markers for the partner export-management sheet while preserving the separate existing profile-editor markers.
- [x] 5.2 Update the administrator partner-export journey in `tests/ui/10-journeys.spec.ts` and its route-registry linkage to open the management sheet first, begin a profile, and verify sequential sheet visibility.
- [x] 5.3 Extend the dataset-detail map journey to verify computed map and legend colors differ appropriately between light and dark appearance while record counts and selection remain stable.
- [x] 5.4 Run the focused component tests, then run `pnpm run smoke:check` to regenerate and validate the shared fixture manifest.

## 6. Terminal Verification and Closeout

- [x] 6.1 Rerun `pnpm run verify:change` for the candidate tracked tree and confirm every listed required command is still represented in the terminal gate.
- [x] 6.2 Run `pnpm run verify:change:run`; for the current worktree this must complete `spec:validate`, `typecheck`, `verify:test-delta`, `verify:app`, `smoke:check`, targeted/full UI smoke, `db:security`, and `db:check-migration-drift` as selected by the planner.
- [x] 6.3 Classify and fix any failure as environment, test gap, contract/harness, or product; rerun the narrow failing check and then rerun `pnpm run verify:change:run` until the terminal gate passes.
- [x] 6.4 If the terminal gate starts repo-local Docker or Supabase, stop it with the repo-scoped command, run required Docker cache cleanup, and preserve named volumes and persistent data.
- [x] 6.5 Rerun `pnpm run verify:change`, verify no implementation task remains, and archive `refine-dataset-exploration-controls` before any `verify:ship:local` or ship work.
