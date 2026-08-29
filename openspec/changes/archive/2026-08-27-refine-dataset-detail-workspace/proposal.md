## Why

The dataset-detail workspace still separates closely related controls, leaves the primary data viewport shorter than the filter column, and gives the data grid a harsher surface than the surrounding AX components. Bringing these elements into one visual system will improve scanning and make the desktop workspace feel deliberate without changing dataset behavior or permissions.

## What Changes

- Place the Table and Map view controls beside the existing administrator-only Partner exports action in the dataset page toolbar.
- Combine the Current filtered table summary/actions and Filters into one cohesive left-column component on desktop while retaining the narrow-screen Filters sheet.
- Size the table viewport to align with the combined left-column component at the desktop breakpoint.
- Apply the same soft semantic component background to the data-grid header, rows, pinned cells, and empty/loading surface in both light and dark appearance modes.
- Preserve all existing filter, download, saved-table, assignment, partner-export, map, and record-profile behavior.
- Update direct component tests and UI smoke coverage for the revised layout and surfaces.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard-layout`: Combine the dataset summary and filter controls, align the data viewport height, and use a cohesive soft surface treatment.
- `dataset-map-exploration`: Place the Table and Map mode controls in the shared dataset toolbar without changing view behavior.

## Impact

- Affected UI: `src/app/dashboard/datasets/[datasetId]/page.tsx`, `src/components/dashboard/dataset-detail-client.tsx`, `src/components/dashboard/dataset-table-action-bar.tsx`, `src/components/dashboard/dataset-view-switch-grid.tsx`, and `src/components/dashboard/dataset-table.tsx`.
- Affected verification: same-stem component tests, dataset-detail page tests, and `tests/ui/10-journeys.spec.ts` if browser assertions need adjustment.
- Auth/admin permissions: unchanged. Partner exports and Assign to dataset remain available only to `admin` and `super_admin` identities, with the existing eligibility conditions for assignment.
- Data integrity, Supabase, Vercel deployment configuration, and API contracts: unchanged.
- UI smoke coverage: existing dataset detail, filter sheet, map, assignment sheet, and partner-export surfaces remain covered; selectors will be updated only where the revised layout requires it.
- Non-goals: redesigning filter logic, export management, map behavior, saved-table persistence, responsive navigation, or role definitions.
