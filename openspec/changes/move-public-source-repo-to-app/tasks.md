## 1. Repo Workflow Update

- [x] 1.1 Make release GitHub deployment polling use current-repo API paths.
- [x] 1.2 Update release tests for repo-agnostic deployment polling.
- [x] 1.3 Update release/current-state/developer docs for
  `Accelerate-Global/app` as canonical source and `online` as private archive.

## 2. Provider Migration

- [x] 2.1 Create private `Accelerate-Global/app` and push only clean `main`.
- [ ] 2.2 Configure new repo settings, Actions, Dependabot, and branch
  protection/ruleset.
- [x] 2.3 Reconnect the existing Vercel `online` project to
  `Accelerate-Global/app`.
- [ ] 2.4 Verify production deployment records, `data.accelerateglobal.org`,
  Supabase drift, and release health.
- [x] 2.5 Switch `Accelerate-Global/app` public after publication-safety scans
  and before Vercel Git connection because Vercel Hobby does not support private
  organization repo connections.

## 3. Verification

- [x] 3.1 Run focused tests for release tooling and publication safety.
- [x] 3.2 Run `pnpm run spec:validate`, `pnpm run typecheck`, and
  `pnpm run verify:change:run`.
- [x] 3.3 Run public-readiness scans before pushing and before public
  visibility.
