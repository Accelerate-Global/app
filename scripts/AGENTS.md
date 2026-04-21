# Script Notes

- `/Users/blake/Documents/accelerate-global/online/scripts/ci-select-validation.ts` decides whether `Dependency Audit` should run based on `package.json` and `pnpm-lock.yaml`.
- `/Users/blake/Documents/accelerate-global/online/scripts/ship.ts` must wait for `App Quality`, `UI Smoke`, `Database Security`, and `Dependency Audit` before merge.
