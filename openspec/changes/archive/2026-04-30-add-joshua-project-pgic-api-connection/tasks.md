## 1. Planning

- [x] 1.1 Run `pnpm run verify:change` before implementation and capture required commands.
- [x] 1.2 Run `pnpm run task:kickoff -- --scope ...` for the admin/API/Supabase-adjacent work area.

## 2. Joshua Project Connection Behavior

- [x] 2.1 Add a Joshua Project (PGIC) preset to the API Connections UI with keyless endpoint parameters, PGIC dataset settings, and a secret `api_key` field.
- [x] 2.2 Add Joshua Project run preparation so the stored `api_key` secret is appended as a query parameter for the people-groups endpoint and is not sent as a header.
- [x] 2.3 Add Joshua Project row parsing that flattens `Resources` into indexed resource columns and preserves `Resources_raw`.

## 3. Tests

- [x] 3.1 Update API Connections UI tests to cover the Joshua Project preset and confirm the key is not committed into preset defaults.
- [x] 3.2 Update API connection parser/executor tests for Joshua Project resource flattening and generic parser compatibility.

## 4. Verification

- [x] 4.1 Run focused tests for touched API connection modules/components.
- [x] 4.2 Run `pnpm run verify:change` again before terminal verification.
- [x] 4.3 Run `pnpm run verify:change:run` and resolve required-check failures.
