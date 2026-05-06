## 1. Resources Page

- [x] 1.1 Add authenticated `/dashboard/resources` with built-in country-code
      resource content and smoke markers.
- [x] 1.2 Update the dashboard Reference Resources card to link to
      `/dashboard/resources`.
- [x] 1.3 Register the Resources route for signed-in roles in UI smoke.

## 2. Country-Code Resource

- [x] 2.1 Pass admin refresh capability into the country-code client.
- [x] 2.2 Align search, visible count, refresh, and download controls in one
      responsive row.
- [x] 2.3 Hide refresh for non-admins and reject non-admin refresh API calls.
- [x] 2.4 Add staged refresh progress using the existing Progress primitive.
- [x] 2.5 Rename JSON to Download and export visible rows as CSV.

## 3. Verification

- [x] 3.1 Update same-stem page, client, API, and resources tests.
- [x] 3.2 Run focused tests for touched files and `pnpm run smoke:check`.
- [x] 3.3 Run `pnpm run verify:change`, `pnpm run verify:change:run`, and
      archive this OpenSpec change after all required checks pass.
