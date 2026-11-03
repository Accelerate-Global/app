## 1. Planning

- [x] 1.1 Run `pnpm run build` on the pre-change tree and save the built CSS for comparison.
- [x] 1.2 Validate OpenSpec artifacts with `pnpm run spec:validate`.

## 2. Dependencies

- [x] 2.1 Upgrade `shadcn` to 4.23.0, remove the now-unused `@modelcontextprotocol/sdk` override, and regenerate `pnpm-lock.yaml` with pnpm 10.
- [x] 2.2 Confirm `pnpm install --frozen-lockfile` passes from a clean `node_modules` with pnpm 10.28.0 and 10.34.9, and that the lockfile contains only zod 4.6.6.
- [x] 2.3 Confirm `pnpm audit --audit-level=high` exits successfully.

## 3. Closure

- [x] 3.1 Compare built CSS before and after; confirm the app does not use the new shadcn utilities, properties, or keyframes.
- [x] 3.2 Run typecheck, lint, tests, build, `verify:test-delta`, and the shadcn CLI on the candidate tree.
- [x] 3.3 Archive the OpenSpec change.
