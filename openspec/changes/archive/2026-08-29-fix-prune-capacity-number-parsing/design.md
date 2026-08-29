## Context

The prune planner reads live Storage totals and eligible object sizes through PostgreSQL queries in `src/lib/data-archive/prune.ts`, then totals selected objects in memory. PostgreSQL drivers can represent `bigint` and `numeric` values as strings to avoid precision loss. The live plan first encountered that representation only after restore verification made packages eligible, and canonical validation correctly rejected the resulting string total.

The plan is security-sensitive: its byte totals determine whether the owner-approved capacity target is reached and become part of the checksum bound to a later exact-object apply.

## Goals / Non-Goals

**Goals:**

- Accept valid whole-number database byte values whether the driver returns a number, bigint, or decimal digit string.
- Convert only values that are nonnegative JavaScript safe integers.
- Fail closed before protected-plan creation for malformed, fractional, negative, missing, or unsafe values.
- Cover the production-observed string representation with a direct regression test.

**Non-Goals:**

- Change package eligibility, retention thresholds, restore proof, object selection, or deletion approval.
- Change Supabase schema, RLS, Auth metadata, Vercel runtime, or UI behavior.
- Introduce arbitrary-precision arithmetic; current capacity limits are far below JavaScript's safe-integer ceiling.

## Decisions

Use a narrow conversion at the database boundary for both live-Storage aggregates and per-object sizes, returning only validated numbers to the rest of the planner. This keeps canonical plan schemas strict and prevents permissive coercion from spreading to protected plan inputs.

Accept number, bigint, and digit-only string forms because those are the legitimate driver representations of a nonnegative byte aggregate. Reject signs, decimal points, exponents, whitespace, and values greater than `Number.MAX_SAFE_INTEGER`.

Test the converter directly and exercise eligibility mapping with the production-observed text representation. A broad `Number(value)` conversion was rejected because it accepts exponent notation, whitespace, empty strings, and precision-losing integers.

## Risks / Trade-offs

- [A future archive exceeds the safe-integer limit] → Fail closed and require an explicit arbitrary-precision design before planning deletion.
- [A driver returns a new numeric representation] → Fail closed with a specific capacity-value error and add a reviewed representation only after evidence.
- [The conversion masks a malformed query result] → Digit-only and safe-integer validation prevents permissive coercion.

## Migration Plan

Deploy the planner-only fix, rerun direct tests and the repository terminal gate, then regenerate the protected production plan. No database or data migration is required. Rollback is the prior planner, which fails closed and performs no deletion.

## Open Questions

None.
