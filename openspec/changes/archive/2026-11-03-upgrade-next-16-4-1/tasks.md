## 1. Planning

- [x] 1.1 Run `pnpm run verify:change` before edits and record the required commands for the dependency change.
- [x] 1.2 Validate OpenSpec artifacts with `pnpm run spec:validate`.

## 2. Dependencies

- [x] 2.1 Pin `next` and `eslint-config-next` to `16.4.1` and regenerate `pnpm-lock.yaml` with pnpm 10 without changing override semantics.
- [x] 2.2 Confirm `pnpm install --frozen-lockfile` passes from a clean `node_modules`, and that the installed and built Next.js version is 16.4.1.
- [x] 2.3 Run `pnpm audit` and confirm no Next.js advisory remains.

## 3. Closure

- [x] 3.1 Rerun `pnpm run verify:change`, complete its required commands, and pass `pnpm run verify:change:run` on the candidate tracked tree.
- [x] 3.2 Archive the OpenSpec change after all required verification passes.
