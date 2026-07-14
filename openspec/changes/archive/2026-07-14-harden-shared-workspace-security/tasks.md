## 1. Visibility and invitation contracts

- [x] 1.1 Add the workspace-visible compatibility migration, RLS updates, and pgTAP coverage for old/new writes and existing role boundaries.
- [x] 1.2 Rename the dataset visibility TypeScript/API/UI contract to `isWorkspaceVisible` and update direct unit/component tests.
- [x] 1.3 Update supported documentation, current specs, route registry, and user-visible copy from public/private to workspace-visible/restricted.
- [x] 1.4 Remove the public signup page and preflight route while preserving and testing admin invite, resend, callback verification, and invite password setup.

## 2. Runtime security controls

- [x] 2.1 Add environment-aware Postgres TLS options with verified-CA support and direct tests for local and hosted URLs.
- [x] 2.2 Reject cross-origin connector redirects and add exhaustive tests for same-origin compatibility, credential/body non-forwarding, redirect limits, and invalid locations.
- [x] 2.3 Implement comprehensive special-use IP classification and DNS-pinned connector fetches with IPv4, IPv6, mapped-address, multi-address, redirect, and rebinding tests.
- [x] 2.4 Apply private non-store headers through the centralized route guard and test success, errors, downloads, redirects, and `Vary` merging.
- [x] 2.5 Generate request CSP nonces in the proxy, nonce the theme bootstrap, remove script `unsafe-inline` and the Vercel analytics origin, and update proxy/header/layout tests.
- [x] 2.6 Require authentication for app-owned analytics, bound accepted payloads, skip anonymous browser submissions, and update route/client/sweep tests.

## 3. Dependencies and provider configuration

- [x] 3.1 Audit each dependency advisory path, apply compatible updates or overrides, and run package-dependent tests before retaining the lockfile change.
- [x] 3.2 Apply and verify the linked Supabase visibility migration, disable public signup, configure the production database CA, and enable database SSL enforcement without disrupting admin invitations.
- [x] 3.3 Convert Vercel `DATABASE_URL` and Supabase server credentials to Sensitive variables; rotate the database password only if Supabase, local tooling, and Vercel can be updated and verified atomically.

## 4. Verification and completion

- [x] 4.1 Run `pnpm run verify:change`, record the required commands and targeted smoke subset, and run focused tests plus `pnpm run verify:fast` and `pnpm run smoke:check` during implementation.
- [x] 4.2 Run the required database security, migration drift, targeted/full UI smoke, dependency audit, and `pnpm run verify:change:run` terminal gate.
- [x] 4.3 Perform production-safe SSL, signup, authorization, CSP, cache, connector, and environment-metadata checks without reading sensitive data.
- [x] 4.4 Stop repo-local Supabase, reclaim transient Docker build cache, preserve persistent data, mark every task complete, validate the change, and archive it before any release workflow.
