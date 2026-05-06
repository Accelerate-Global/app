## 1. OpenSpec And Data Model

- [x] 1.1 Add OpenSpec deltas for country-code maintenance, reference
      resources discovery, and account-menu appearance.
- [x] 1.2 Add the private country-code alternate-name override migration and
      Drizzle schema.

## 2. Country-Code Resource

- [x] 2.1 Merge persisted alternate-name overrides into generated and refreshed
      country-code resources.
- [x] 2.2 Add the admin-only alternate-name API with validation and tests.
- [x] 2.3 Update the country-code detail sheet for persistent admin add/delete,
      read-only non-admin aliases, no copy controls, and simplified header.
- [x] 2.4 Update refresh success/failure UI feedback.

## 3. Account Menu Appearance And Resources

- [x] 3.1 Add Resources to the account menu for every signed-in role.
- [x] 3.2 Replace separate appearance rows with one compact segmented control.

## 4. Verification

- [x] 4.1 Update focused component, page, API, schema, and smoke contract tests.
- [x] 4.2 Run focused tests, `pnpm run smoke:check`, `pnpm run verify:change`,
      and `pnpm run verify:change:run`.
- [x] 4.3 Archive this OpenSpec change after required verification passes.
