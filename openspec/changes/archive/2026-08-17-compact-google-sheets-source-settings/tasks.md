## 1. Planning and Contracts

- [x] 1.1 Run `pnpm run verify:change` and `pnpm run task:kickoff -- --scope 'src/components/dashboard/api-connection-detail-client*'` to record the required verification lane and targeted smoke subset.
- [x] 1.2 Update the API connection run specification for the Google Sheets source-settings sheet and validate OpenSpec artifacts.

## 2. Connection Detail UI

- [x] 2.1 Replace the always-visible Google Sheets source card with a page-level `Google Sheets source` trigger and responsive right-side sheet.
- [x] 2.2 Preserve all existing Google Sheets metadata, workflow, header, access, link, and disconnect controls inside the sheet.
- [x] 2.3 Add literal smoke trigger, surface, ready, and close markers for the new sheet interaction.

## 3. Test Coverage

- [x] 3.1 Update same-stem component tests to assert the source controls are hidden until the sheet opens and remain functional inside it.
- [x] 3.2 Update the relevant browser journey to open and verify the Google Sheets source sheet before using its actions.

## 4. Verification

- [x] 4.1 Run the direct component test and `pnpm run smoke:check`.
- [x] 4.2 Run every required command reported by `pnpm run verify:change`, including the targeted UI smoke subset when listed.
- [x] 4.3 Run `pnpm run verify:change:run` as the terminal gate, then rerun `pnpm run verify:change` and confirm all requirements are satisfied.
