## Context

The application is a single shared workspace on Vercel backed by Supabase Auth, Postgres, Storage, and Vault. Admin invitations already create the Auth user before sending an invite, while the separate public signup page is redundant. Dataset visibility is currently named `public` even though it means authenticated workspace-member access. Runtime Postgres uses Postgres.js without SSL options, connector redirect handling reuses credentials across origins, authenticated API responses lack a central cache policy, and CSP permits inline scripts.

The change spans runtime code, a compatibility database migration, provider configuration, UI/API vocabulary, tests, and deployment secrets. It must remain usable on Vercel's free tier and must not require MFA.

## Goals / Non-Goals

**Goals:**

- Make workspace visibility terminology unambiguous without changing role access.
- Preserve production availability while introducing the new database field through a compatibility bridge for the currently deployed app.
- Encrypt production Postgres traffic, verify the Supabase certificate chain when the CA is configured, and enforce TLS provider-side.
- Keep admin invitation, resend, callback verification, and invite password setup intact while disabling public signup.
- Prevent outbound secrets from changing origins and pin validated DNS results to the actual connection.
- Make authenticated API responses private/non-cacheable and remove production script `unsafe-inline` through a request nonce.
- Keep app-owned authenticated analytics without anonymous ingestion or paid rate-limiting infrastructure.
- Clear compatible dependency advisories and fully verify the result.

**Non-Goals:**

- MFA, AAL2, SSO, organization tenancy, or changes to workspace roles.
- Vercel Web Analytics, Speed Insights, paid Firewall rules, Drains, or third-party monitoring.
- Reclassifying any dataset or changing who can read restricted data.

## Decisions

### Use a database compatibility bridge for visibility naming

Add canonical `is_workspace_visible`, backfill it from `is_public`, and install a bidirectional consistency trigger while the deployed old application may still write `is_public`. New code and APIs use only `isWorkspaceVisible`; RLS uses the canonical column. Keeping the legacy physical column temporarily avoids a migration/deployment outage while removing the ambiguous vocabulary from every supported application contract. A later database cleanup can remove the compatibility column only after all deployed revisions using it have expired.

Alternative considered: directly rename the column. Rejected because applying the migration before the new Vercel deployment would break the currently running application, while deploying code first would fail against the old schema.

### Separate local and production Postgres TLS behavior

A shared Postgres connection-options helper identifies loopback/local Supabase URLs and leaves TLS off locally. Non-local connections require TLS; when `DATABASE_SSL_CA` is present, Postgres.js receives the CA with certificate and hostname verification. Production Vercel receives the Supabase CA and Supabase SSL enforcement is enabled only after a verified TLS connection succeeds.

Alternative considered: `ssl: "require"` alone. This encrypts traffic but Postgres.js disables certificate verification for that mode, so it is only an interim fallback and not the production target.

### Preserve invitations and remove self-signup entirely

Remove the public signup page, signup preflight route, and browser `signUp` call. Supabase project email signup is disabled. Admin `inviteUserByEmail` remains allowed because it is an Auth Admin operation that pre-creates the user and sends the existing invite callback to `/reset-password`.

### Reject credential-bearing cross-origin redirects

Redirects are permitted only when the next URL has the same origin as the original URL. This preserves normal same-host redirects and avoids ambiguous attempts to classify which custom headers or request bodies are secret. Method/body redirect behavior remains unchanged only within that origin.

### Pin outbound connections after DNS validation

Resolve all addresses, reject all non-global/special-use IPv4 and IPv6 ranges including mapped IPv4, choose a validated address, and make the actual request through a dispatcher whose DNS lookup returns that chosen address. Revalidate every redirect. Hostname and TLS SNI remain the original hostname, so certificate verification continues to work.

Alternative considered: resolve immediately before normal `fetch`. Rejected because the fetch performs a second DNS resolution and remains vulnerable to rebinding.

### Apply authenticated cache policy in the route guard

Every guard result—success and normalized error—receives `Cache-Control: private, no-store, max-age=0`, `Pragma: no-cache`, and `Vary: Cookie, Authorization`. This covers protected JSON, downloads, and signed redirects without relying on individual handlers.

### Generate CSP nonces in the proxy

The proxy creates a cryptographically random nonce, places the nonce-bearing CSP on both the forwarded request and response, and forwards `x-nonce`. The root layout reads the nonce and assigns it to the theme bootstrap script. Static security headers remain in `next.config.ts`, but CSP becomes request-scoped. Production `script-src` contains `self`, the nonce, and `strict-dynamic`; development retains only the runtime allowances needed by Next.js.

### Require authentication for product analytics

The analytics route moves under the central user route guard. Client tracking skips anonymous contexts, and payload strings/numeric duration receive explicit bounds. Existing server-side/internal analytics and the admin dashboard remain unchanged. The residual Vercel analytics script origin is removed from CSP; no Vercel analytics package is installed.

### Upgrade dependencies conservatively

Use package-manager updates/overrides only after identifying each advisory path. Run direct package-dependent tests, the complete app test/build lane, database security, UI smoke, and the terminal change gate. Do not replace major frameworks solely to clear a development-only advisory.

## Risks / Trade-offs

- [Two visibility columns can diverge] → A database trigger enforces equality and pgTAP verifies old- and new-client writes.
- [TLS enforcement can interrupt connections briefly] → Verify the exact production connection with CA first, update Vercel configuration, deploy/health-check if authorized, then enable enforcement and retest.
- [Password rotation can disconnect the app] → Rotate only when Supabase, local tooling, Vercel Sensitive environment variables, and production verification can be updated in one controlled sequence; otherwise retain the existing password rather than leave partial state.
- [DNS pinning can affect multi-address/CDN endpoints] → Select from all validated addresses, retain hostname/TLS verification, and test every built-in provider plus redirect/IPv4/IPv6 cases.
- [Nonce CSP forces dynamic rendering] → Authenticated pages already depend on request/session state; verify public auth pages and the full UI smoke suite for regressions.
- [Anonymous auth events disappear] → This is intentional to remove the unauthenticated write surface; authenticated product telemetry remains available.

## Migration Plan

1. Add and locally verify the visibility compatibility migration and application contract changes.
2. Add TLS, connector, cache, CSP, signup, analytics, and dependency remediations with focused tests.
3. Run local database security and the repository terminal gate.
4. Apply the compatibility migration to linked Supabase; verify both columns and RLS without reading dataset contents.
5. Configure verified database TLS and Vercel Sensitive variables. Rotate the password only if the full atomic update path is available.
6. Disable public signup and enable Supabase SSL enforcement after invitation and TLS checks pass.
7. Re-run production-safe authorization, header, SSL, and invitation-configuration checks.

Rollback restores the prior Vercel deployment and provider settings. The compatibility trigger keeps old and new dataset visibility clients functional during rollback. SSL enforcement can be disabled only if required to restore connectivity; public signup remains disabled unless the admin invitation flow itself is proven unavailable.

## Open Questions

None. Provider mutations are gated by successful local and read-only production verification.
