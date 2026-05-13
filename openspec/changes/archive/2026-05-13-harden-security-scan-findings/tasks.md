## 1. Dependencies

- [x] 1.1 Upgrade `next` and `eslint-config-next` to exact `16.2.6`.
- [x] 1.2 Move `shadcn` to dev dependencies at `4.7.0`.
- [x] 1.3 Add patched `pnpm.overrides` for vulnerable transitive audit paths and regenerate the lockfile.

## 2. CSV Hardening

- [x] 2.1 Add a shared CSV cell escape helper that neutralizes spreadsheet formula-leading values.
- [x] 2.2 Reuse the shared helper for dataset downloads, API connection CSV downloads, and API import snapshots.
- [x] 2.3 Add focused CSV tests for formula neutralization and preserved quoting, BOM, and line-ending behavior.

## 3. Refresh Mutation Semantics

- [x] 3.1 Convert ISO country-code and ROP-code refresh route mutation handlers from `GET` to `POST`.
- [x] 3.2 Add `GET` method-not-allowed handlers with `Allow: POST`.
- [x] 3.3 Update dashboard clients and tests to call refresh endpoints with `POST`.

## 4. Verification and Closure

- [x] 4.1 Run focused dependency audit and Vitest commands for the touched surfaces.
- [x] 4.2 Run `pnpm run verify:fast`, `pnpm run verify:change`, and the required terminal gate.
- [x] 4.3 Mark tasks complete and archive the OpenSpec change after verification passes.
