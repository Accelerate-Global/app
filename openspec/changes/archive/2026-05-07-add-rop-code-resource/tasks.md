## 1. Planning

- [x] 1.1 Run `pnpm run verify:change` before implementation.
- [x] 1.2 Run `pnpm run task:kickoff` for the owned ROP UI, data, API, script,
  smoke, and OpenSpec paths.

## 2. Source Data

- [x] 2.1 Add typed ROP resource models, ArcGIS fetch helpers, validation, CSV
  helpers, flattened hierarchy matching, and geo-index grouping.
- [x] 2.2 Add a local refresh script and package command that rewrites the
  generated ROP JSON snapshot.
- [x] 2.3 Generate the initial checked-in ROP resource from HIS.

## 3. Web UI

- [x] 3.1 Add the admin-only refresh API route.
- [x] 3.2 Add the authenticated ROP dashboard page with smoke markers.
- [x] 3.3 Add the ROP client component with search, virtualized single table,
  download, refresh, and detail sheet behavior.
- [x] 3.4 Add the ROP resource card to `/dashboard/resources`.
- [x] 3.5 Register the ROP route and detail sheet in UI smoke coverage.

## 4. Tests and Verification

- [x] 4.1 Add same-stem tests for ROP helpers, refresh route, page, client, and
  resources card behavior.
- [x] 4.2 Run direct tests for the changed units and components.
- [x] 4.3 Run `pnpm run smoke:check`.
- [x] 4.4 Rerun `pnpm run verify:change`, then run every required command
  including `pnpm run verify:change:run`.
- [x] 4.5 Archive the OpenSpec change after implementation and required
  verification pass.
