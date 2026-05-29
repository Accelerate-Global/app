## 1. Planning And Auth Boundary

- [x] 1.1 Run `pnpm run task:kickoff` for dashboard/auth/menu scope and rerun `pnpm run verify:change` after edits identify required gates.
- [x] 1.2 Add a proxy-verified identity fast path that sanitizes internal auth headers and preserves existing cookie refresh behavior.
- [x] 1.3 Update server identity resolution to use the proxy fast path for page renders while preserving fallback auth resolution.

## 2. Dashboard Navigation UI

- [x] 2.1 Add the shared authenticated dashboard layout and move repeated `SiteHeader` rendering out of dashboard pages.
- [x] 2.2 Add dashboard segment loading UI with existing skeleton primitives.
- [x] 2.3 Convert account-menu page navigation rows to Next link behavior with destination-scoped prefetch.
- [x] 2.4 Keep all existing dashboard page smoke markers and redirects intact after layout extraction.

## 3. Tests And Contracts

- [x] 3.1 Update proxy/auth tests for sanitized internal identity headers and fallback auth behavior.
- [x] 3.2 Update account-menu and dashboard page/layout tests for link navigation and shared header rendering.
- [x] 3.3 Run `pnpm run smoke:check` and fix any route marker or shared fixture contract failures.

## 4. Verification And Archive

- [x] 4.1 Run the required commands reported by `pnpm run verify:change`, including app, UI smoke, OpenSpec, and DB security gates.
- [x] 4.2 Run `pnpm run verify:change:run` as the terminal gate for the candidate tracked tree.
- [x] 4.3 Archive the completed OpenSpec change after implementation and verification pass.
