## 1. Retire redundant admin surfaces

- [x] 1.1 Replace Field Sources and Analytics pages with compatible redirects and remove their account-menu entries
- [x] 1.2 Remove the unsupported Field Sources read API, Analytics failure-triage API, and page-only client controls
- [x] 1.3 Update Definitions copy so field-source relationships remain understandable without the retired page

## 2. Surface useful admin metadata

- [x] 2.1 Add a Last sign-in column and precise never-signed-in state to User Management
- [x] 2.2 Rebuild the Connections Resources card as a Source, Entries, and Last updated table

## 3. Coverage and documentation

- [x] 3.1 Update same-stem tests, route registry entries, journeys, smoke-selection coverage, and change-impact mapping
- [x] 3.2 Update user and architecture documentation for the retired pages, preserved data, and authentication-recency semantics

## 4. Verification and completion

- [x] 4.1 Run the required focused tests, smoke contract checks, and every command reported by `pnpm run verify:change`
- [x] 4.2 Run `pnpm run verify:change:run`, verify the affected UI flows, and prepare the completed change for archive
