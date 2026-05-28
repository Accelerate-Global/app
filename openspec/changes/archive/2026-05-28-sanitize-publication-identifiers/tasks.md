## 1. Current-tree sanitization

- [x] 1.1 Replace real admin/personal email identifiers with neutral example
  identities across tests, docs, OpenSpec artifacts, and migrations.
- [x] 1.2 Update current workspace-role specs/docs so first-admin bootstrap is
  provider-owned and does not name a real user.
- [x] 1.3 Re-run current-tree searches to confirm the real identifiers are gone
  from tracked files.

## 2. Audit reporting

- [x] 2.1 Produce a sanitized findings ledger under ignored audit artifacts.
- [x] 2.2 Produce a final public-readiness report that separates current-tree
  remediation from approval-gated history rewrite.

## 3. Verification

- [x] 3.1 Run focused tests for touched same-stem test files.
- [x] 3.2 Run `pnpm run spec:validate`.
- [x] 3.3 Run `pnpm run verify:change` and `pnpm run verify:change:run`.
