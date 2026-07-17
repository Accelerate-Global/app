## 1. Navigation and editor UI

- [x] 1.1 Rename the admin account-menu label to `Field Sources` and update its direct permission-aware test.
- [x] 1.2 Make the partner export profile sheet full-width on mobile and half-width at wider breakpoints, clarify automatic filename fragments, and update its direct component test.

## 2. Traceable artifact filenames

- [x] 2.1 Add a pure, tested helper that builds sanitized dataset/profile/timestamp filenames for all partner artifact kinds.
- [x] 2.2 Use the source dataset and download request time in authorized partner artifact responses without changing stored artifact paths or contents.

## 3. Verification and specification lifecycle

- [x] 3.1 Run direct tests, `pnpm run smoke:check`, and all commands required by `pnpm run verify:change`.
- [x] 3.2 Verify the implementation against this OpenSpec change, sync the delta specs, and confirm archive readiness.
