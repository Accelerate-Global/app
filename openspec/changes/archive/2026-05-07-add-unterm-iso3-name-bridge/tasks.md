## 1. Planning

- [x] 1.1 Run `pnpm run verify:change` before editing to capture the initial gate.
- [x] 1.2 Run `pnpm run task:kickoff` for the owned country-code resource paths.

## 2. Source Bridge

- [x] 2.1 Add UNTERM and UNSD M49 source metadata and resource entry fields.
- [x] 2.2 Implement UNTERM workbook parsing with required-header and minimum-row validation.
- [x] 2.3 Implement M49 bridge parsing and normalized UNTERM-to-ISO3 matching.
- [x] 2.4 Include UNTERM and M49 in refresh and generated JSON output while preserving curated aliases.

## 3. UI and API

- [x] 3.1 Update refresh API fixtures/tests for official-name metadata.
- [x] 3.2 Show official UN short/formal names in the country-code detail sheet.
- [x] 3.3 Include official UN fields in search and CSV download.

## 4. Verification

- [x] 4.1 Add/update direct unit and component tests for parsing, refresh, search, and CSV export.
- [x] 4.2 Run `pnpm run spec:validate`.
- [x] 4.3 Rerun `pnpm run verify:change` and complete every required command.
- [x] 4.4 Run `pnpm run verify:change:run` as the terminal gate.
