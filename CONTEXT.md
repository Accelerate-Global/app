# CONTEXT.md — Domain Glossary

Domain language for the CSV Dataset Viewer. Architecture vocabulary (module,
interface, depth, seam, adapter, locality, leverage) follows the standard
deepening glossary. Terms here are canonical: prefer them over synonyms in
code, docs, and discussion.

## Core data concepts

- **Dataset** — an uploaded or API-imported CSV: metadata in Postgres, parsed
  rows in JSONB (`dataset_rows`), raw file in Supabase Storage.
- **Dataset version** — an immutable snapshot created on replace/revert.
- **Derived view / derived dataset** — a dataset whose contents are produced
  from a source dataset plus assigned filters; refreshed when the source changes.
- **Saved table** — an owner-scoped saved exploration of a dataset (filters +
  sorting), stored in `saved_dataset_tables`.
- **Default view** — the filters + sorting a dataset opens with
  (`defaultFilters` on the dataset).
- **Field definition / field source** — admin-managed column documentation and
  provenance shown in table headers.

## Filtering vocabulary

- **Filter section** — one independently toggleable unit of row filtering.
  The five sections: **region**, **country**, **UUPG**, **hotspots**,
  **watchlist**. (Already reified in analytics as `filter_sections_enabled`.)
- **Filter sections state (`DatasetFilterSections`)** — the canonical combined
  runtime representation of all five sections. Decided 2026-06-10: this is the
  single runtime currency for filtering; per-section `*FilterState` shapes are
  implementation detail of the filtering module.
- **Filter pipeline** — the ordered application of sections to rows
  (region → watchlist → hotspots → UUPG → country). Ordering and the
  hotspots↔UUPG coupling (hotspot ranking respects the UUPG section) are
  implementation of the filtering module, never caller knowledge.
- **Evaluation result** — what the filtering module returns:
  `{ rows, availableCountryNames }`. Available country names are computed
  before the country section so the country picker can offer alternatives.
- **Open preset** — the filter sections a dataset link opens with
  (historically `DatasetOpenPreset`, the saved state minus sorting).
- **Saved filter state (`SavedDatasetFilterState`)** — the persisted wire
  format (sections + sorting + rule versions) stored on saved tables and
  dataset default views.

## Watchlist rules

- **Watchlist rule** — a named criterion contributing to the watchlist
  section. Current family: **population-believers** (tiered),
  **JP-only-evangelical** (thresholds), **engagement-phase** (range).
- Rule modules share a parallel shape (defaults, normalize, is-default, match)
  but no formal shared interface yet.

## API connections

- **API connection** — an admin-configured upstream source (Google Sheets,
  Etnopedia, ArcGIS, generic HTTP) that imports rows into datasets.
- **Run** — one execution of a connection: queued → running → success/failed,
  with run logs and run output artifacts in Storage.
- **Provider** — the upstream-specific fetch/parse behavior of a connection.
  Detection today: explicit provider field (Google Sheets) or URL/format
  heuristics (Etnopedia, ArcGIS).

## Identity

- **Workspace role** — `member`, `admin`, `super_admin` from
  `auth.users.raw_app_meta_data.workspace_role`; admin-capable roles surface
  as `identity.isDatasetAdmin`.

## Architecture decisions (inline log; load-bearing rejections graduate to docs/adr/)

- **2026-06-10 — Filtering module.** `src/lib/dataset-filtering.ts` (renamed
  from `dataset-region-filtering.ts`) owns the filter pipeline behind one
  entry point taking rows + `DatasetFilterSections`, returning the evaluation
  result. Filtering only — sorting stays in `sortDatasetRows`.
  `getEnabledFilterSections` moves here from `analytics.ts`. The five
  `filterDatasetRowsBy*` functions and eight `datasetSupports*Filtering`
  predicates stop being exported.
- **2026-06-10 — Saved-view state.** `SavedDatasetFilterState` remains the
  persisted wire format (no data migration); the saved-view module parses it
  to `DatasetFilterSections` and serializes back only at its own boundary.
  `DatasetOpenPreset` dissolves — an open preset is a `DatasetFilterSections`
  value, not a distinct type. The flat UI state shape
  (`InitialDatasetDetailState`) moves out of `lib/` into the dashboard
  components as their implementation detail.
- **2026-06-10 — Connection provider seam.** `src/lib/api-connections/`
  becomes a package: run lifecycle + registry at the top, adapters under
  `providers/{google-sheets,etnopedia,arcgis,generic-http}.ts`, index
  re-export preserves `@/lib/api-connections` imports. Detection: each
  adapter owns `matches(connection)`; registry tries in order with
  generic-http last (pure refactor; persisting an explicit provider field is
  a possible later step). Adapters receive a run-scoped logger and emit
  domain log lines; orchestration owns log persistence, run state, artifacts,
  resource extraction, and dataset publication. SSRF guarding
  (`assertSafeApiUrl`) lives with the generic-http adapter's fetch path.
- **2026-06-10 — Route guard.** A wrapper (`withRoute({ access, action })`)
  owns identity resolution, 401/403 gating, try/catch, `logError`, and
  `jsonError` normalization for all `src/app/api/**/route.ts` handlers.
  Payload zod-parsing stays inside handlers (payload shapes are too diverse
  to centralize). Enforcement: a registry-style static sweep test asserts
  every API route uses the guard.
- **2026-06-10 — Watchlist rule seam deferred.** See
  `docs/adr/0001-defer-watchlist-rule-interface.md`. Revisit trigger: a
  fourth watchlist rule is requested.
- **2026-06-10 — Implementation note.** All four accepted decisions above are
  implemented: `src/lib/dataset-filtering.ts` (pipeline),
  `src/lib/saved-dataset-filters.ts` + `src/components/dashboard/dataset-detail-initial-state.ts`
  (saved-view state), `src/lib/api-connections/` (provider seam package),
  and `src/lib/route-guard.ts` + `src/lib/route-guard-sweep.test.ts`
  (route guard). Consolidating the filter pipeline also fixed a real drift
  bug: the saved-table CSV download previously ignored the UUPG criteria when
  ranking hotspot countries, diverging from the client view.
