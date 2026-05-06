## 1. Planning

- [x] 1.1 Run `pnpm run verify:change` before implementation and record required commands.
- [x] 1.2 Run `pnpm run task:kickoff` for the owned UI, API, resource, data, and spec paths.

## 2. Resource Data and Refresh

- [x] 2.1 Commit the curated transposed country/territory CSV overlay into `src/data`.
- [x] 2.2 Add parser coverage for the overlay format, aliases, inactive rows, blanks, and duplicate ISO3 groups.
- [x] 2.3 Add GENC and legacy FIPS fetch/parsing helpers and merge them with ISO and the overlay.
- [x] 2.4 Generate the enriched checked-in JSON resource with 273 entries, 249 official ISO entries, and 259 active entries.

## 3. Web UI and API

- [x] 3.1 Retitle the country-code page and resource labels to country/territory language.
- [x] 3.2 Update the client table, search, copy, download, and refresh behavior for aliases, FIPS, GENC, status, and classification.
- [x] 3.3 Update same-stem route/client/API tests for the enriched resource shape.

## 4. Verification

- [x] 4.1 Run direct Vitest coverage for the resource parser/merge logic, client, page, API route, dashboard, and API Connections tests.
- [x] 4.2 Run `pnpm run smoke:check`.
- [x] 4.3 Rerun `pnpm run verify:change` and all required commands, including `pnpm run verify:change:run`.
- [x] 4.4 Archive the OpenSpec change after verification passes.
