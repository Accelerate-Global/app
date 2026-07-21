## 1. Resource status presentation

- [x] 1.1 Stop requesting and rendering inactive candidate labels on active resource catalog cards.
- [x] 1.2 Add resource-page regression coverage proving candidate/build labels remain hidden when an active version exists.

## 2. ROP table presentation

- [x] 2.1 Remove the browser-page “loaded of total” badge while retaining taxonomy counts and retrieval time.
- [x] 2.2 Suppress table and detail warnings for expected ROP25 parent-only rows while retaining genuine join warnings.
- [x] 2.3 Update ROP client tests for the simplified summary and conditional warning behavior.

## 3. ROP refresh reliability

- [x] 3.1 Adjust the ROP25 source-count safety floor to accept the verified 8,991-row HIS layer while preserving large-drop protection.
- [x] 3.2 Add a focused source-count regression test and verify the live build passes the count floor while still rejecting genuine hierarchy corruption.

## 4. Verification and completion

- [x] 4.1 Run `pnpm run verify:change`, all required focused checks, `pnpm run smoke:check`, and `pnpm run verify:change:run`.
- [x] 4.2 Verify implementation evidence against the OpenSpec change and sync the modified specifications before archive.
