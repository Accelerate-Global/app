## 1. Plan and Pin

- [x] 1.1 Run `pnpm run verify:change` and `pnpm run task:kickoff` for the owned workflow, policy-test, and OpenSpec paths.
- [x] 1.2 Resolve current official Node.js 24-compatible action releases, immutable commit SHAs, runtime declarations, and migration notes.
- [x] 1.3 Refresh all repository-owned action references and version comments without changing tool versions or workflow behavior.

## 2. Verify and Close

- [x] 2.1 Update and run workflow bootstrap policy tests, then validate the OpenSpec change.
- [x] 2.2 Run `pnpm run verify:change`, all required commands, and `pnpm run verify:change:run` for the candidate tree.
- [x] 2.3 Verify the implementation against the change, archive it, and pass `pnpm run verify:ship:local`.
- [x] 2.4 Prepare pull request 59 to require every hosted check and reject repository-owned Node.js 20 annotations before merge.
