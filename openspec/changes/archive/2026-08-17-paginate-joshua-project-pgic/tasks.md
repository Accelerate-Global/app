## 1. Planning and Contracts

- [x] 1.1 Run `pnpm run verify:change` and `pnpm run task:kickoff -- --scope 'src/lib/api-connections/**' --scope 'src/app/api/admin/api-connections/**' --scope 'openspec/changes/paginate-joshua-project-pgic/**'`, then record the required verification lane.
- [x] 1.2 Add direct tests for Joshua Project page construction, ordered aggregation, progress, termination, invalid/repeated pages, upstream failures, byte/page limits, and provider precedence.

## 2. Joshua Project Provider

- [x] 2.1 Implement a provider-specific bounded Joshua Project page fetcher using the existing pinned HTTPS, redirect, timeout, and redaction controls.
- [x] 2.2 Register the provider before generic HTTP and update the code-managed request defaults without changing stored Vault behavior or generic provider limits.
- [x] 2.3 Declare and test the bounded Vercel execution duration for the admin API-connection run route.

## 3. Verification

- [x] 3.1 Run direct touched tests and `pnpm run verify:fast`, fixing any product, test-gap, contract/harness, or environment failures.
- [x] 3.2 Run `pnpm run verify:change`, all listed required commands, and the terminal `pnpm run verify:change:run` gate.
- [x] 3.3 Verify the completed implementation against the OpenSpec artifacts and archive the change before any ship-local or release work.
