## 1. Planning

- [x] 1.1 Run `pnpm run verify:change` before implementation and record required commands.
- [x] 1.2 Run `pnpm run task:kickoff` for the owned UI, API, resource, script, and smoke-registry paths.

## 2. Official Source Refresh

- [x] 2.1 Implement typed ISO country-code resource models and validation helpers.
- [x] 2.2 Implement the official ISO OBP scraper and a reusable refresh function.
- [x] 2.3 Add a local refresh script and package command that rewrites the generated JSON resource.
- [x] 2.4 Generate the initial checked-in ISO country-code resource from the official source.

## 3. Web UI Resource

- [x] 3.1 Add an authenticated API route that returns live ISO refresh data without mutating server state.
- [x] 3.2 Add an authenticated dashboard page for the ISO country-code resource with smoke markers.
- [x] 3.3 Add a client component for search, visible-row counts, copy, download, and live refresh.
- [x] 3.4 Register the new route in `tests/ui/route-registry.ts`.

## 4. Tests and Verification

- [x] 4.1 Add or update same-stem tests for changed page, route, scraper, and client behavior.
- [x] 4.2 Run direct tests for the new resource and UI components.
- [x] 4.3 Run `pnpm run smoke:check` after the UI route registry update.
- [x] 4.4 Rerun `pnpm run verify:change`, then run every required command including `pnpm run verify:change:run`.
- [x] 4.5 Archive the OpenSpec change after implementation and required verification pass.
