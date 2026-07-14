# Security Assessment — July 14, 2026

## Scope and security model

The application is a single shared workspace. No dataset is anonymous or
internet-public. A **workspace-visible** dataset is readable by signed-in basic,
pro, and admin users; a **restricted** dataset is readable only by admins. The
login, password-recovery, invitation callback, and password-setup surfaces are
the only intentionally public application flows.

The assessment covered the Next.js application and API boundary, Supabase Auth
and Postgres configuration, RLS and table privileges, outbound API connectors,
Vercel environment variables and production deployment behavior, browser
security headers, analytics ingestion, and dependency advisories.

## Findings and disposition

| ID | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| Naming | Informational | `public` was overloaded between the PostgreSQL `public` schema, anonymous access, and signed-in workspace visibility. | Replaced the application contract with `isWorkspaceVisible` / `is_workspace_visible` and UI language with workspace-visible/restricted. A database trigger keeps the deprecated `is_public` column synchronized during mixed-version deployment. |
| TM-01 | High | Remote Postgres connections did not centrally require TLS or verify the Supabase CA, and linked-project SSL enforcement was off. | Remote connections now require TLS; production requires the Supabase CA and rejects unverifiable connections. Linked-project SSL enforcement is on, an unencrypted connection was proven rejected, and the production connection was proven certificate-verified. Local loopback Supabase remains usable without TLS. |
| TM-02 | Critical | A credential-bearing connector request could follow a redirect to another origin and resend headers, query secrets, or a request body. | Redirects are manual, limited to three, revalidated at every hop, and restricted to the original scheme/host/port before any second request is made. |
| TM-03 | Accepted | MFA is not mandatory for workspace users. A compromised email account can therefore enable account takeover through an invitation or recovery link. | Deliberately accepted by the project owner. The application relies on each recipient's email-account security. No MFA or setup-auth requirement was added. |
| TM-04 | High | Public email/password self-signup remained available alongside the admin invitation workflow. | Global Supabase signup is disabled locally and in the linked project while the email provider remains enabled. The `/sign-up` page and route were removed. A live preflight proves even an allowlisted email cannot self-sign up while an admin-provisioned user can set credentials and sign in. |
| TM-05 | Critical | Production database and provider credentials were ordinary encrypted Vercel variables, and the database password had not been rotated as part of remediation. | `DATABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are Vercel Sensitive variables; the Google private key and cron secret were already Sensitive. The database password was rotated through the Supabase Management API, the local and Vercel connection strings were updated, and the existing production artifact was redeployed successfully. Temporary credential material was deleted. |
| TM-06 | Critical | Connector SSRF validation had incomplete address coverage and a DNS time-of-check/time-of-use gap because `fetch` resolved the hostname again after validation. | Only global-unicast IPv4/IPv6 addresses are accepted, including mapped-address normalization and mixed-answer rejection. The validated address is pinned into the HTTPS socket lookup while the original hostname remains responsible for SNI and certificate verification. Redirect targets are independently resolved and pinned. |
| TM-07 | High | Authenticated API responses did not consistently prevent intermediary or browser caching. | The central route guard now applies `Cache-Control: private, no-store, max-age=0`, `Pragma: no-cache`, `Expires: 0`, and `Vary: Cookie, Authorization` to success, error, redirect, JSON, and download responses. |
| TM-08 | High | The static CSP allowed inline scripts and could not authorize individual Next.js scripts safely. | CSP is generated per request with a cryptographically random nonce, forwarded to Next.js, returned to the browser, and applied to the inline theme script. Production `script-src` uses the nonce and `strict-dynamic` without `unsafe-inline`; `unsafe-eval` is development-only. |
| TM-09 | Medium | Anonymous first-party analytics ingestion and residual Vercel Analytics CSP allowances increased unauthenticated write and script/connect surface. | The analytics endpoint is now covered by the authenticated route guard, verified identity overwrites client actor fields, payload/body bounds are enforced, and anonymous browser events are not transmitted. No Vercel Analytics package or component remains and its CSP origin was removed. No paid Vercel firewall feature was enabled. |
| TM-10 | Moderate | Five dependency advisories were present: three moderate and two low. | Compatible overrides removed all moderate advisories and the esbuild low advisory. One low, development-only `@babel/core` advisory remains because the registry has no patched 7.x release and forcing Babel 8 would be an incompatible toolchain change. Build, type, lint, Vitest, Drizzle, and UI verification cover the overrides. |

## Security invariants after remediation

- Anonymous users have no privileges on workspace data tables. Authenticated
  table grants are explicit and RLS remains the row-level authorization layer.
- Admin invitation and password setup remain available; self-signup does not.
- Mutating API requests remain centrally same-origin guarded.
- Provider errors remain normalized before logging.
- Production database access is both server-enforced TLS and client-verified TLS.
- No paid Vercel firewall, WAF, rate-limit, or analytics feature was introduced.

## Production operations completed

- Supabase Auth: global signup disabled; email sign-in enabled.
- Supabase Postgres: password rotated; SSL enforcement enabled.
- Supabase schema: the workspace-visibility compatibility migration is applied;
  linked migration history matches, remote schema lint is clean, and all 116
  remote database security assertions pass in a rolled-back test transaction.
- Vercel: secret variables converted to Sensitive; Supabase CA added; existing
  production artifact redeployed and attached to `data.accelerateglobal.org`.
- Health: the public authentication entry returned `200`; an unauthenticated guarded API request
  returned `401`; the invitation-only Auth preflight passed against the linked
  project after the password rotation and redeploy.

The provider controls and compatibility migration above are live. The
repository application changes remain on the local candidate tree and should
enter production through the project's normal reviewed release workflow; this
assessment did not bypass that workflow with a direct source deployment.
