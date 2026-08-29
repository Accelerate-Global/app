## Why

The first live prune plan with restore-verified packages failed closed because PostgreSQL returned a `bigint` object-size value as text while the canonical planner required a JavaScript number. The planner must normalize and validate database byte values before it can safely calculate or checksum a production capacity projection.

## What Changes

- Parse PostgreSQL byte values through one bounded safe-integer conversion before calculating or constructing the protected plan.
- Reject missing, negative, fractional, malformed, or unsafe-size aggregates without writing a plan or deleting Storage objects.
- Add direct regression tests for the live text representation and invalid values.
- Keep package eligibility, operator approval, exact-object deletion, restore evidence, retention, Auth, database records, and user-facing behavior unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `samson-data-archive`: Protected prune plans accept valid PostgreSQL byte-value representations while continuing to fail closed on invalid or unsafe capacity values.

## Impact

- Affected code: `src/lib/data-archive/prune.ts` and its direct test.
- Affected systems: the read-only Supabase capacity-plan path used by the Samson archive operator.
- Supabase is affected only through read-only numeric-value interpretation; no migration, Auth, admin-permission, API-contract, Vercel, or UI-smoke change is required.
- Brownfield behavior and safeguards remain grounded in `docs/operations/samson-data-archive.md` and `openspec/specs/samson-data-archive/spec.md`.
