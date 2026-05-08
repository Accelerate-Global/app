## 1. Resources UI

- [x] 1.1 Add the ROP Codes built-in row to the Datasets Resources card.
- [x] 1.2 Remove category header, cells, and placeholder text from the Resources table.
- [x] 1.3 Update component tests for the ROP row and two-column Resources table.

## 2. Resource Persistence Contract

- [x] 2.1 Remove `category` from the API connection resource TypeScript shape and mapping.
- [x] 2.2 Stop extracting, merging, and inserting resource category metadata.
- [x] 2.3 Update API connection resource extraction, listing, and publishing tests.

## 3. Supabase Schema

- [x] 3.1 Create a Supabase migration that drops `private.api_connection_resources.category`.
- [x] 3.2 Remove the Drizzle schema column and update schema tests.

## 4. Verification

- [x] 4.1 Run `pnpm run verify:change` and complete every required command it lists.
- [x] 4.2 Run direct touched tests for component, API connection, and schema behavior.
- [x] 4.3 Run `pnpm run smoke:check`.
- [x] 4.4 Run `pnpm run spec:validate`.
- [x] 4.5 Run `pnpm run verify:change:run`.
