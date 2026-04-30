## 1. OpenSpec Artifacts

- [x] 1.1 Create a dedicated OpenSpec change for finish-session closure policy.
- [x] 1.2 Add proposal, design, delta spec, and implementation tasks.

## 2. Policy Update

- [x] 2.1 Update root `AGENTS.md` with a completion-before-summary closure loop.
- [x] 2.2 Tighten `Open Items` and `Next Step` footer wording so they only carry
  true blockers or user-owned actions.

## 3. Verification

- [x] 3.1 Run `pnpm run spec:validate`.
- [x] 3.2 Run `pnpm run verify:change` after implementation and review required
  commands for the candidate tree.
- [x] 3.3 Run `pnpm run verify:change:run` if feasible against the current dirty
  tree, or record any blocker caused by unrelated in-progress work.
