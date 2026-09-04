## 1. Planning and Preservation

- [x] 1.1 Run `pnpm run verify:change` and `pnpm run task:kickoff` for the owned Worker, CI, security, dependency, documentation, and OpenSpec paths.
- [x] 1.2 Preserve the ten-file uncommitted Qwen TLS state in a dedicated commit and push its temporary rescue branch before cleaning the stale primary worktree.
- [x] 1.3 Create the proposal, design, delta specs, and implementation checklist for this readiness cleanup.

## 2. Qwen TLS Source Reconciliation

- [x] 2.1 Restore the completed `secure-qwen-origin-tls` archive and merge its private-model-gateway requirement into the current durable spec without losing later Qwen requirements.
- [x] 2.2 Change the Worker origin hostname and same-stem tests to `samson.risencode.org`, preserving the VPC binding, route allowlist, request/response bounds, and credential stripping.
- [x] 2.3 Merge the strict TLS identity, certificate inventory, renewal, verification, and rollback evidence into the current Worker and private-chat runbooks.
- [x] 2.4 Verify Worker types, focused tests, deployment dry-run, live `verify_full` VPC state, deployed-version metadata, and unauthenticated Access denial.

## 3. Safe CI Browser Artifacts

- [x] 3.1 Add a bounded safe-smoke reporter and direct tests proving errors, logs, and attachment details are reduced to counts.
- [x] 3.2 Configure Playwright to disable trace, screenshot, and video capture in CI and emit only the safe JSON reporter while retaining full local diagnostics.
- [x] 3.3 Update the UI Smoke workflow to upload only the safe result file for seven days.
- [x] 3.4 Extend workflow bootstrap policy and tests to reject raw Playwright directories, traces, screenshots, videos, and multi-path UI-smoke artifact uploads.

## 4. Public Repository Governance and Documentation

- [x] 4.1 Add the approved proprietary-use notice and a public `SECURITY.md` that directs reports through private vulnerability reporting without exposing secrets or exploit details.
- [x] 4.2 Add actionable first-admin/bootstrap, signup-allowlist ownership, and API-connection provider-governance runbooks; close the corresponding undefined repository questions.
- [x] 4.3 Reconcile current-state, release, archive, Qwen, and open-question documentation with verified live provider state and intentional future program boundaries.
- [x] 4.4 Enable and verify available GitHub secret scanning, push protection, private vulnerability reporting, CodeQL default setup, SHA pinning, seven-day retention, merged-branch deletion, and strict `main` protection for administrators.
- [x] 4.5 Delete retained raw UI-smoke artifacts, close obsolete bot pull requests, and archive the former private source repository while preserving historical read access.

## 5. Dependency Remediation

- [x] 5.1 Add range-scoped pnpm overrides for the compatible patched `esbuild`, `postcss`, `undici`, `hono`, and `qs` releases and regenerate the exact lockfile.
- [x] 5.2 Run `pnpm audit` with no remaining advisory, verify the dependency paths, and run package/tooling-focused tests that cover the overridden graph.
- [x] 5.3 Correct the five initial CodeQL sanitizer findings in Etnopedia and country-code plain-text parsing, add adversarial same-stem tests, and make a zero-alert post-merge analysis a release acceptance check.

## 6. Verification and Change Closure

- [x] 6.1 Re-run `pnpm run verify:change`; record every required command, targeted smoke subset, and local Supabase requirement for the actual diff.
- [x] 6.2 Run focused Worker, reporter, workflow-policy, dependency, documentation, OpenSpec, and smoke-contract checks, then `pnpm run verify:fast`.
- [x] 6.3 Run `pnpm run verify:change:run` as the terminal gate, classify and fix every failure, and confirm repo-local Docker/Supabase cleanup.
- [x] 6.4 Verify implementation completeness, correctness, and design coherence against this change with no critical or warning findings.
- [x] 6.5 Sync delta specs, archive this completed change, rerun `pnpm run verify:change`, and pass `pnpm run verify:ship:local` before opening the release pull request.
