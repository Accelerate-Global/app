## 1. Planning

- [x] 1.1 Run `pnpm run verify:change` before implementation and record required commands.
- [x] 1.2 Run `pnpm run task:kickoff` for the owned UI, API, resource, data, and spec paths.

## 2. OpenSpec

- [x] 2.1 Create `add-rog3-country-codes` proposal, design, spec delta, and task checklist.
- [x] 2.2 Validate the OpenSpec change before final verification.

## 3. Resource Data and Refresh

- [x] 3.1 Add ROG3 source metadata and a nullable `rog3` entry field while preserving `fips`.
- [x] 3.2 Add NGA GENC/GEC workbook parsing and validation coverage.
- [x] 3.3 Merge ROG3 onto curated rows with code/name/alias/fallback matching that preserves split territories.
- [x] 3.4 Refresh the generated country-code JSON snapshot.

## 4. Web UI and API

- [x] 4.1 Update page, client, refresh copy, search, detail sheet, and CSV output to show both FIPS and ROG3.
- [x] 4.2 Update same-stem route, client, API, and field-source tests for the additive ROG3 resource shape.

## 5. Verification

- [x] 5.1 Run the country-code refresh command.
- [x] 5.2 Run direct Vitest coverage for the touched resource, UI, route, API, and seed files.
- [x] 5.3 Run `pnpm run smoke:check`.
- [x] 5.4 Run `pnpm run spec:validate`.
- [x] 5.5 Rerun `pnpm run verify:change` and complete every required command, including `pnpm run verify:change:run`.
