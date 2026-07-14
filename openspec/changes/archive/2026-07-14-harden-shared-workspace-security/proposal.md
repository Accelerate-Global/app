## Why

The shared workspace contains highly sensitive datasets and connector credentials, but the current production posture leaves database transport, outbound connector redirects, invitation-only provisioning, response caching, and browser script policy less strict than the product's actual trust model requires. The remediation should close those gaps without introducing MFA, paid Vercel services, or disruption to the admin invitation and invite-link account setup workflow.

## What Changes

- **BREAKING** Rename dataset `public` visibility to `workspace-visible` across the database column, application/API contract, UI, tests, documentation, and durable specifications; this remains authenticated-member visibility, never anonymous visibility.
- Require verified TLS for production Postgres clients, enable linked Supabase database SSL enforcement, and preserve local non-TLS Supabase development.
- Disable public email/password self-signup while preserving admin `inviteUserByEmail`, invite resend, token-hash verification, password setup, and the resulting authenticated session.
- Prevent connector secrets and sensitive bodies from crossing origins during redirects; harden SSRF checks against DNS rebinding, IPv4-mapped IPv6, and complete non-public address ranges.
- Mark production database and Supabase server credentials as non-readable Vercel Sensitive environment variables; rotate the database password only when the provider and deployment updates can be completed and verified atomically.
- Apply private, non-store response headers to authenticated API responses and signed-download redirects.
- Replace the production script CSP `unsafe-inline` allowance with a per-request nonce and remove the residual Vercel Web Analytics script origin.
- Remove anonymous app-analytics ingestion while preserving authenticated app-owned analytics, with strict payload bounds and no paid firewall dependency.
- Update vulnerable dependency paths only after compatibility review, then verify application, database, UI, and release workflows.
- MFA and AAL2 enforcement remain explicit non-goals for this change.

## Capabilities

### New Capabilities
- `database-transport-security`: Verified production Postgres TLS, provider enforcement, and safe credential rotation requirements.
- `invitation-only-account-provisioning`: Admin invitations remain the only account creation entry point while invite-link password setup remains usable.
- `browser-content-security`: Per-request script nonces and a production CSP without `script-src 'unsafe-inline'`.
- `deployment-secret-security`: High-impact server credentials use non-readable Vercel Sensitive storage and remain server-only.

### Modified Capabilities
- `authenticated-dataset-access`: Replace public/private dataset vocabulary and wire fields with workspace-visible/restricted terminology without changing access boundaries.
- `api-connection-runs`: Enforce same-origin secret forwarding and rebinding-resistant outbound network validation.
- `api-route-security`: Authenticated routes return private non-store responses and analytics ingestion is no longer an anonymous exemption.
- `dependency-security`: Clear known moderate and low audit paths where compatible, not only high-severity paths.
- `vercel-analytics-pause`: Persist client analytics only after authentication and remove the remaining Vercel collector origin allowance.

## Impact

- Auth/admin: public `/sign-up` behavior is removed; `src/lib/user-management.ts`, invite callbacks, and reset-password setup remain supported and tested.
- Data/API: `isPublic` / `is_public` becomes `isWorkspaceVisible` / `is_workspace_visible` through a Supabase migration and corresponding API contract update.
- Runtime security: `src/db/index.ts`, `src/proxy.ts`, `src/lib/security-headers.ts`, `src/lib/route-guard.ts`, and connector core networking change.
- Deployment: linked Supabase Auth/SSL settings and Vercel production environment-variable metadata change; database password rotation is performed only if it can be completed without a user handoff.
- Dependencies: `package.json` and `pnpm-lock.yaml` may change after compatibility validation.
- UI smoke: removing the signup page and changing dataset visibility controls requires route-registry and targeted auth/dataset smoke updates.
