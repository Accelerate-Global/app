## 1. Dependency resolution

- [x] 1.1 Upgrade the Next.js framework and matching ESLint configuration to the patched release.
- [x] 1.2 Update transitive security overrides and regenerate the exact pnpm lockfile.

## 2. Focused verification

- [x] 2.1 Run the high-severity dependency audit and confirm no critical or high findings remain.
- [x] 2.2 Verify the shadcn developer CLI and production application build with the patched graph.

## 3. Repository release gates

- [x] 3.1 Run strict OpenSpec validation and the repository terminal verification gate.
- [x] 3.2 Verify the implementation against the OpenSpec artifacts and confirm archive readiness.
- [x] 3.3 Confirm the zero-advisory evidence, clean diff, and PR update are ready; archive the change before commit and ship work.
