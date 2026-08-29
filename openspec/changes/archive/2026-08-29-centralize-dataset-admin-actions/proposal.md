## Why

Dataset detail currently mixes a dataset-level administrator workflow with the Table/Map view switch, while the filtered-view creation action uses language that does not explain that it creates a dataset from the current filters. Centralizing dataset-level administration and clarifying the contextual action will make the page easier to understand without changing permissions or data behavior.

## What Changes

- Replace the standalone administrator-only Partner exports toolbar button with one administrator-only Dataset actions menu.
- Put Edit dataset and Partner exports in that menu, keeping destructive, replacement, history, and configuration controls on the existing edit page.
- Rename Assign to dataset to Create dataset from current view and keep it with the Current filtered table actions because it operates on the active filter state.
- Keep Table and Map as a separate view switch in the same toolbar.
- Preserve the existing partner-export slide-outs, derived-view creation behavior, responsive filter sheet, and admin-only authorization.
- Update component tests and UI smoke coverage for the menu and renamed action.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard-layout`: Define the separation between dataset-level administrator actions, filtered-view actions, and Table/Map view controls on dataset detail.
- `partner-export-profiles`: Move the existing compact Partner exports entry into the centralized administrator Dataset actions menu without changing the export workflow.

## Impact

- Affected UI: `src/app/dashboard/datasets/[datasetId]/page.tsx`, dataset-detail toolbar/action components, partner-export trigger integration, and related component and browser-smoke tests.
- Auth and admin permissions: no permission change; `admin` and `super_admin` remain the only roles that receive dataset administrator actions.
- Data integrity, Supabase, API contracts, and Vercel deployment behavior: no change.
- UI smoke coverage: update the dataset-detail journey to exercise the new menu surface and renamed derived-view trigger.
- Non-goals: moving filtered-view creation into the dataset-level menu; duplicating replace, delete, version-revert, or configuration controls from the existing dataset edit page; changing export generation or derived-view persistence.
