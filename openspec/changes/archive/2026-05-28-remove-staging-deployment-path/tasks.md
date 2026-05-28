## 1. Provider Cleanup

- [x] 1.1 Snapshot the current Vercel custom environments and project build settings.
- [x] 1.2 Delete the `staging` custom environment from the Vercel `online` project.
- [x] 1.3 Update the Vercel ignored-build-step command to allow only `main`.
- [x] 1.4 Verify the custom environment is removed, the build policy is main-only, and the production alias responds.

## 2. Repo Documentation

- [x] 2.1 Update current-state and release docs to describe the production-only deployment path.
- [x] 2.2 Update developer contribution docs if needed so release guidance matches the provider state.

## 3. Verification

- [x] 3.1 Run `pnpm run spec:validate`.
- [x] 3.2 Run `pnpm run verify:change` and complete all listed required commands.
- [x] 3.3 Run `pnpm run verify:change:run`.
