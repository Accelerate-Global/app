## 1. Remove Runtime Branding

- [x] 1.1 Run `pnpm run verify:change` and a scoped `pnpm run task:kickoff` before editing the map UI and its same-stem test.
- [x] 1.2 Remove the optional Natural Earth link and simplify the legend layout without changing map behavior or repository provenance.
- [x] 1.3 Update the map-view component test to prove no Natural Earth/provider branding is rendered while the legend remains.
- [x] 1.4 Inspect the live local map for remaining provider/source branding and confirm the map still renders after filters change.

## 2. Verify and Archive

- [x] 2.1 Run the direct map tests, smoke contract, every command required by `pnpm run verify:change`, and `pnpm run verify:change:run`.
- [x] 2.2 Archive `remove-dataset-map-attribution`, rerun strict OpenSpec validation, and leave production deployment out of scope.
