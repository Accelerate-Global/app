## Context

The current map journey uses the three-row primary smoke dataset and proves only initial rendering, a zero-result Watchlist case, table fallback, and provider-free boundary loading. The release-readiness checklist also needs production-shaped volume, broader filter parity, representative country resolution, roles, responsive behavior, keyboard access, and appearance coverage. Production Supabase is explicitly unavailable to local credentials, so the suite must remain deterministic and disposable.

## Goals / Non-Goals

**Goals:**

- Seed a separate 1,500-row local dataset derived from the repository-owned ISO country catalog.
- Exercise multiple API pages and map aggregation without slowing or destabilizing the existing three-row fixture assumptions.
- Assert that map totals equal the filtered table total through Region, Country, Watchlist, UUPG, and Hotspots changes.
- Cover representative aliases, mapped and unmapped records, search, keyboard selection, mobile/dark layout, authorized roles, provider-free requests, and a generous no-freeze timing ceiling.
- Make future map changes select the expanded journeys automatically.

**Non-Goals:**

- Reading, copying, or mutating linked production datasets.
- Adding migrations, external map providers, paid services, or production deployment steps.
- Treating automated rendering as approval of disputed geopolitical boundaries.
- Replacing the existing focused component and small-fixture journeys.

## Decisions

1. **Use a separate deterministic smoke dataset.** A new workspace-visible PGAC fixture avoids changing counts and names assumed by existing tests. Its rows are generated from `src/data/iso-country-codes.generated.json`, repeated with deterministic variations in people-group names and filter fields. A static copied production export was rejected because it could become stale, contain sensitive data, and create a large maintenance burden.

2. **Use 1,500 rows.** This is large enough to force multi-page dataset loading and meaningful aggregation while remaining cheap for local Postgres, Vitest, and browser smoke. A tens-of-thousands fixture was rejected because it would make every smoke bootstrap disproportionately expensive.

3. **Assert parity from visible application totals.** Browser helpers will read the filtered-table, mapped, and unmapped counts and require `mapped + unmapped = filtered`. The same helper is reused after filter changes so the contract is independent of boundary-library coverage.

4. **Keep performance protection generous and local.** The desktop journey will require the large dataset map to become ready within a broad thirty-second ceiling. This catches hangs and severe regressions without pretending local timing predicts Vercel latency.

5. **Split browser responsibilities.** A desktop Pro journey covers the complete filter/search/network flow; a cross-role desktop journey proves the large dataset is visible without permission leakage; and a mobile Pro journey covers dark appearance, overflow, and keyboard-operable country selection.

6. **Expose both map totals to smoke tests.** The existing mapped-count marker is paired with an unmapped-count marker. This is test observability only and does not alter visible copy or the map data contract.

7. **Use the existing self-managed smoke lifecycle.** The full UI smoke suite owns disposable local Supabase startup, bootstrap, and shutdown. RLS and `raw_app_meta_data.workspace_role` behavior remain unchanged; the new dataset uses the same workspace-visible access path as existing smoke datasets.

## Risks / Trade-offs

- **[Risk] Full smoke takes longer because 1,500 rows are inserted.** → Keep the large fixture separate, generate it in memory once per bootstrap, and cap it at 1,500 rows.
- **[Risk] Country catalog changes alter mapped/unmapped counts.** → Assert invariants and representative outcomes rather than one brittle global mapped total.
- **[Risk] Filter interaction sequences retain earlier state.** → Reload the fixture between independent filter scenarios or explicitly restore toggles before the next assertion.
- **[Risk] Mobile keyboard semantics are imperfect on touch projects.** → Use a native keyboard event against the rendered SVG country control and assert the textual summary, not visual focus styling.
- **[Risk] Local timing varies by machine.** → Use a generous ceiling and retain Playwright traces on failure.

## Migration Plan

No production migration is required. The change adds local fixtures and tests only. Rollback consists of removing the new fixture, bootstrap entry, smoke journeys, markers, and selection metadata. The terminal verification gate will stop disposable Supabase after the suite; the interactive preview can then be restarted with preserved local volumes.

## Open Questions

None. Subjective review of politically sensitive boundary representation remains a human release decision rather than an automated assertion.
