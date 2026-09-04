## Why

The canonical public repository is deployable, but its local and provider state
are not fully reproducible: the live Qwen TLS identity exists only in an
uncommitted worktree, UI smoke still retains credential-bearing browser
artifacts, and compatible dependency/security maintenance is incomplete. These
gaps must be closed before the repository can be treated as a clean starting
point for new work.

## What Changes

- Restore the completed `secure-qwen-origin-tls` archive and make the Worker
  hostname/SNI in `origin/main` match the live `verify_full` Cloudflare VPC
  service and Samson Origin CA certificate.
- Disable Playwright trace, screenshot, and video capture in CI; publish only a
  bounded sanitized JSON smoke summary for seven days; and make workflow policy
  reject unsafe UI-smoke artifact paths.
- Add public vulnerability-reporting and proprietary-use notices, enable the
  available GitHub repository security controls, and retire automation on the
  private historical repository.
- Resolve compatible moderate and low dependency advisories with scoped pnpm
  overrides and an exact regenerated lockfile.
- Enable CodeQL default setup and correct every initial high-severity finding in
  external Etnopedia and country-code plain-text normalization with adversarial
  same-stem tests.
- Reconcile current-state and open-question documentation with verified live
  branch protection, Samson, Qwen, and provider state.
- Remove obsolete local branches, worktrees, stashes, remote refs, and retained
  raw CI artifacts only after their unique content is preserved on the
  canonical branch.

## Capabilities

### New Capabilities

- `repository-security-governance`: Defines the public repository's security
  reporting, scanning, branch-protection, artifact-retention, and historical
  repository retirement contract.

### Modified Capabilities

- `private-model-gateway`: Requires the source-controlled VPC request hostname
  to match the hostname verified by the live Origin CA certificate, with
  provider/source drift treated as a release blocker.
- `openspec-automation`: Requires CI browser smoke to suppress authenticated
  diagnostic capture and upload only a bounded sanitized result artifact.
- `tier1-source-forming`: Requires Etnopedia prose extraction to remain inert
  plain text even for encoded or overlapping markup.
- `iso-country-code-resource`: Requires imported country names to decode one
  entity layer without producing executable or multiply decoded markup.

## Impact

- Repository and CI: `.github/workflows/ui-smoke.yml`, Playwright smoke config,
  workflow-policy scripts/tests, public security files, package overrides, and
  `pnpm-lock.yaml`.
- External-source parsing: Etnopedia and ISO/M49/FIPS text normalization plus
  their existing same-stem unit suites.
- Qwen edge: Worker source/tests, Cloudflare gateway runbook, private-chat
  runbook, and the durable private-model-gateway spec. The live VPC service,
  certificate, Access policy, HMAC contract, and canary membership do not
  change.
- Providers: GitHub artifacts and repository settings are cleaned up; Vercel
  continues to deploy from merges to `main`; Supabase receives no schema or
  data mutation.
- Auth, admin permissions, application API contracts, data integrity, dataset
  behavior, and user-facing UI behavior remain unchanged. UI smoke coverage is
  preserved while its CI artifact output is reduced.
- Non-goals: expanding the Qwen canary, executing Plan 002 pipeline cutover,
  selecting a new off-site backup provider, or changing production datasets.
