## 1. Bounded hierarchy normalization

- [x] 1.1 Add the `missing-rop2` join issue and bounded absolute/ratio tolerance to HIS source validation.
- [x] 1.2 Preserve unresolved ROP2 codes, ROP25/ROP3 content, and geography data in normalized rows without inventing ROP1 terms.
- [x] 1.3 Keep missing ROP1 and excessive missing-ROP2 relationships fatal.

## 2. Candidate lifecycle and projections

- [x] 2.1 Allow bounded missing-ROP2 placeholders through package validation and typed projection preparation.
- [x] 2.2 Generate structured warning findings for affected candidate rows so warning-only candidates remain valid and reviewable.

## 3. Regression coverage

- [x] 3.1 Add ROP builder tests for accepted bounded orphans and rejected excessive orphans.
- [x] 3.2 Add adapter and refresh tests for unresolved-code preservation and warning candidate creation.
- [x] 3.3 Update ROP client coverage to prove missing-ROP2 remains an actionable visible warning.
- [x] 3.4 Reproduce the current live HIS build successfully with one bounded warning.

## 4. Verification and release preparation

- [x] 4.1 Run focused tests, `pnpm run smoke:check`, `pnpm run verify:change`, and `pnpm run verify:change:run`.
- [x] 4.2 Verify the implementation evidence against this change and sync the durable ROP spec.
- [x] 4.3 Confirm the release candidate is ready to archive before running the post-archive ship gate.
