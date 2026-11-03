## 1. Planning

- [x] 1.1 Run `pnpm run verify:change` and record the required commands.
- [x] 1.2 Validate OpenSpec artifacts with `pnpm run spec:validate`.

## 2. Dependencies

- [x] 2.1 Update and add same-major `pnpm.overrides` security pins, then regenerate `pnpm-lock.yaml` with pnpm 10.
- [x] 2.2 Confirm `pnpm install --frozen-lockfile` passes from a clean `node_modules` with pnpm 10.34.9 and 10.28.0.
- [x] 2.3 Run `pnpm audit --audit-level=high` and record the remaining zod 3.x finding via `shadcn@4.7.0`.

## 3. Closure

- [x] 3.1 Run typecheck, lint, tests, build, `verify:test-delta`, and the OpenSpec checks on the candidate tree.
- [x] 3.2 Archive the OpenSpec change.
