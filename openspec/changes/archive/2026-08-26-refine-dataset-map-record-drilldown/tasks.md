## 1. Map Presentation and Aggregation

- [x] 1.1 Extend country aggregation with one stable selectable summary for every mapped record, including unnamed-row fallbacks.
- [x] 1.2 Replace the heavy selected-country stroke with a thinner brand-aligned treatment that leaves count fill semantics unchanged.
- [x] 1.3 Recompose map search, full-width geography, legend, and selected-country results into a responsive vertical layout.

## 2. Record Drill-down

- [x] 2.1 Add bounded country record results with select-all, individual selection, progressive reveal, and all/selected table actions.
- [x] 2.2 Add parent-owned temporary map table scope while preserving canonical filtered rows for Map mode and saved filter state.
- [x] 2.3 Add a clear temporary-scope banner and make table rows open the shared read-only record profile sheet.
- [x] 2.4 Build the accessible read-only record profile sheet from existing visible column labels and formatted values.

## 3. Coverage and Verification

- [x] 3.1 Update aggregation, map, table-state, dataset-detail, and profile component tests for every new interaction and text-safety behavior.
- [x] 3.2 Add smoke markers and responsive browser coverage for full-width layout, record selection, table handoff, scope clearing, and profile opening.
- [x] 3.3 Run `pnpm run verify:change`, direct tests, `pnpm run smoke:check`, and any targeted browser debugging required by the changed-area plan.
- [x] 3.4 Run `pnpm run verify:change:run` and verify implementation against the OpenSpec artifacts before archive.
