## 1. Plan and Scope

- [x] 1.1 Run `pnpm run verify:change` and record the required commands, targeted smoke subset, and local Supabase need.
- [x] 1.2 Run `pnpm run task:kickoff -- --scope 'src/lib/data-archive/prune.ts,src/lib/data-archive/prune.test.ts,openspec/changes/fix-prune-capacity-number-parsing/**'`.

## 2. Numeric Boundary Fix

- [x] 2.1 Add a strict nonnegative safe-integer normalizer for database byte values.
- [x] 2.2 Apply the normalizer to per-object sizes and current-Storage totals before capacity calculation and protected-plan construction.
- [x] 2.3 Add direct regression tests for number, bigint, decimal string, malformed, fractional, negative, and unsafe values.

## 3. Verification and Release

- [x] 3.1 Run the changed-area tests and `pnpm run verify:fast`.
- [x] 3.2 Run `pnpm run verify:change:run` and every command required by the refreshed change plan.
- [x] 3.3 Regenerate the live read-only plan and confirm exact integer capacity projection below the approved warning target before deletion.
- [x] 3.4 Verify the OpenSpec change, sync its delta, and archive it before ship-local or release work.
