## Why

The protected Dependency Audit check began rejecting the release candidate after new advisories identified the installed Next.js framework and transitive developer-tool packages as vulnerable. The repository must move to patched compatible versions before the pipeline implementation can merge and deploy.

## What Changes

- Upgrade Next.js and its matching ESLint configuration to the patched 16.2.11 release.
- Refresh the repository dependency overrides so audited runtime and toolchain paths resolve to patched versions.
- Regenerate the pnpm lockfile and verify the installed dependency graph has no high-severity advisories.
- Keep application APIs, authentication, admin permissions, data behavior, Supabase schema, Vercel behavior, and UI behavior unchanged.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `dependency-security`: Require the current framework and installed transitive dependency graph to resolve outside the newly reported vulnerable ranges.

## Impact

The change is limited to `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, dependency-security tests/specification, and release verification. It does not alter API contracts, Supabase state, authentication, admin permissions, data integrity behavior, or UI smoke coverage. Existing dependency policy is documented in `openspec/specs/dependency-security/spec.md`; the GitHub Dependency Audit workflow is the release evidence source.
