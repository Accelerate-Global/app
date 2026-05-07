## Context

`/dashboard/country-codes` provides the closest local pattern: a generated
checked-in resource, an authenticated dashboard page, admin-only live refresh,
CSV download, detail sheet, route-registry coverage, and direct tests. The HIS
ROP source differs in size and shape: it exposes four hierarchy tables plus a
ROP3 geography index through ArcGIS FeatureServer layers.

## Decisions

- Use HIS ArcGIS FeatureServer as the canonical source:
  - Layer 1: ROP1AffinityBloc
  - Layer 2: ROP2PeopleCluster
  - Layer 3: ROP25KinshipGroup
  - Layer 4: ROP3People
  - Layer 0: ROP3GeoIndex, detail-only
- Store a generated JSON snapshot in the repo and expose typed helpers from app
  code. The UI can load deterministically even if HIS is unavailable.
- Add an admin-only refresh endpoint that fetches fresh HIS data and returns the
  resource for the current browser session. The endpoint does not write files at
  runtime.
- Render one flattened table rather than separate tabs. Each row has one display
  field for each ROP term: `ROP1`, `ROP2`, `ROP25`, and `ROP3`.
- Use a complete row universe: one row per ROP3 person plus parent-only ROP25
  rows that have no ROP3 child.
- Match parents through the registry chain `ROP3 -> ROP25 -> ROP2 -> ROP1`.
  When ROP25 is missing, fall back to the direct ROP3 `ROP2` and flag the row.
  When the direct ROP3 `ROP2` conflicts with the ROP25 parent, prefer the
  registry-chain parent and flag the row.
- Use virtualization for the table because the ROP3 row set is about 13k rows.
- Keep ROP data read-only in v1: no local aliases, status toggles, or persisted
  overrides.

## Data Shape

The generated resource includes source metadata, flattened entries, geography
rows grouped by ROP3, counts, and join issue counts. Each flattened entry keeps
separate code/name fields for search and detail rendering, while table display
uses combined term labels such as `A013 - Sub-Saharan African Peoples`.

## Risks / Trade-offs

- HIS schema or availability changes -> validation checks counts, required
  fields, code formats, duplicate keys, and valid parent links before accepting
  refreshed data.
- Large client payload -> the table renders virtually and the detail-only
  geography map is compact, but the resource remains client-searchable and CSV
  exportable without adding a database.
- Imperfect source joins -> rows stay visible with issue labels instead of being
  silently hidden.

## Rollback

Remove the route, resource card, generated ROP data, refresh script/API, tests,
route registry entries, package script, and this OpenSpec change.
