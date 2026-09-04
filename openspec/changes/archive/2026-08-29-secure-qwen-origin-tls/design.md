## Context

The existing edge path is Vercel → Cloudflare Access → Worker → one Workers VPC Service → the Samson gateway at `10.77.0.30:8443` → loopback llama.cpp. The hop through Workers VPC uses HTTPS, but the VPC Service currently has certificate verification disabled because Samson's private CA is outside Cloudflare's trust store. The Worker also requests `https://accelerate-qwen-gateway.internal`, which supplies the origin `Host` header and TLS SNI even though VPC routing is fixed by the binding.

Cloudflare Origin CA certificates are trusted for Cloudflare-to-origin connections. `risencode.org` is an active Cloudflare zone in the WMTEK account, while the Worker, Tunnel, Access application, and VPC Service are intentionally in Blake's personal Cloudflare account. Trust is based on the Cloudflare Origin CA root and hostname validation, so the zone does not need to be moved and no public DNS record is required. The VPC Service continues to route only to the configured tunnel, IP, and port.

The production feature flag remains disabled during this infrastructure cutover. The change does not touch Supabase, RLS, auth metadata, application API behavior, UI routes, or the Vercel runtime configuration.

## Goals / Non-Goals

**Goals:**

- Make the Cloudflare-to-Samson TLS hop fail closed unless the certificate chains to a trusted CA and matches `samson.risencode.org`.
- Preserve the current single-destination VPC routing, Access service authentication, HMAC/replay protection, and gateway containment boundary.
- Make the certificate identity, expiry, deployment sequence, verification evidence, and rollback procedure explicit and testable.
- Avoid moving Samson into public DNS or making it directly reachable from browsers.

**Non-Goals:**

- Encrypting or redesigning Samson's internal-only loopback and private host networking.
- Enabling the production chatbot, changing the production canary, or rotating unrelated credentials.
- Changing the semantic catalog, SQL compiler, database role, prompt contract, or model runtime.
- Adding a public tunnel hostname, public DNS address record, or browser-trusted origin endpoint.

## Decisions

### Use a certificate-only private hostname

The certificate has one SAN, `samson.risencode.org`, and the private key is generated and retained on Samson. The hostname is an identity for SNI and certificate matching, not a DNS routing mechanism. No `A`, `AAAA`, `CNAME`, or public Tunnel hostname is created.

Alternative considered: a new dedicated domain. This adds registrar and zone operations without improving the private VPC boundary. A subdomain of the existing active zone gives the same cryptographic hostname validation with less operational surface.

Alternative considered: keep the existing self-signed/private CA. Workers VPC cannot validate that CA through its supported trust mode, so it would preserve the temporary exception.

### Let the VPC binding route and the request URL identify

The VPC Service remains pinned to the existing Tunnel, `10.77.0.30`, and HTTPS port `8443`. The Worker changes only its origin base URL to `https://samson.risencode.org`. For VPC Service `fetch`, that URL supplies the HTTP `Host` and TLS SNI while the binding supplies the network route.

Alternative considered: create public DNS that resolves to Samson. This is unnecessary for a VPC binding and would create a misleading or potentially public routing surface.

### Finish in `verify_full`

After the new certificate is installed and the Worker sends the matching SNI, the VPC Service certificate-verification mode is changed to `verify_full`. Provider acceptance is layered so the write-only Production Access secret never leaves Vercel: the deployed Worker must deny an unauthenticated `/health` request, and a randomized disposable health-only Worker bound to the exact same VPC Service must receive a successful `/health` response through `verify_full` before being deleted and rechecked as absent. A certificate-chain, expiry, or hostname error must prevent that VPC health proof rather than falling back to unverified TLS.

Alternative considered: verification without hostname matching. That leaves a valid-but-wrong certificate usable and does not close the original security exception.

### Stage the cutover so every step is reversible

The sequence is certificate issuance and offline key/certificate validation; live origin install and restart while VPC verification remains disabled; Worker hostname deployment; VPC `verify_full`; then end-to-end verification. The prior Samson certificate/key are retained in a root-only rollback directory for this cutover. The Worker source and VPC mode can be reverted independently if a later stage fails.

### Treat expiry as owned inventory

Cloudflare does not send Origin CA expiry notifications. Operator documentation records the certificate expiry (`2028-08-28 21:57 UTC`), the exact hostname, the root-only key location, the renewal order, and a renewal window that begins at least 30 days before expiry. Secrets and certificate private-key material do not enter the repository.

## Risks / Trade-offs

- **[Cross-account ownership]** The zone and VPC resources are in different Cloudflare accounts → Document both account/resource identifiers and prove compatibility with a live `verify_full` request instead of assuming it.
- **[Ordering outage]** Enabling strict verification before both the certificate and Worker SNI change would break the relay → Keep verification disabled until origin and Worker checks pass, then make `verify_full` the final mutation.
- **[Origin restart gap]** Installing the certificate requires a short gateway restart → Perform an atomic file install, retain the previous pair root-only, and verify service state plus `/health` immediately after restart.
- **[No automated expiry email]** A two-year certificate can expire silently → Record the expiry and renewal owner/procedure in the runbook and include certificate-date inspection in routine operations.
- **[Origin CA is not browser-trusted]** Direct clients would reject the certificate → Keep Samson private and test only through Workers VPC or with the explicit Cloudflare Origin CA root during local diagnostics.
- **[Production Access secret is write-only]** Exporting or rotating it solely for TLS verification would weaken secret handling → Test the unchanged Access boundary and strict VPC boundary independently, using a randomized health-only Worker that is deleted immediately after one bounded request.
- **[Dirty shared worktree]** Unrelated backup and application changes affect broad repo gates → Restrict edits to declared paths, preserve unrelated changes, and run the repository's single terminal gate on the combined candidate tree.

## Migration Plan

1. Generate an RSA private key and CSR on Samson for only `samson.risencode.org`; issue a two-year Cloudflare Origin CA certificate from the active `risencode.org` zone.
2. Validate SAN, dates, CA chain, hostname, and key match before changing the live service.
3. Retain the previous certificate/key in a root-only rollback directory, install the new pair, restart the gateway, and verify local plus connector-side health and SNI.
4. Update and test the Worker origin URL, then deploy the Worker to the existing personal-account service.
5. Verify the deployed Worker remains protected by Access without exporting the provider-owned Production service-token secret.
6. Update the existing VPC Service to `verify_full`; confirm the production Worker denies unauthenticated traffic; then use and immediately delete a randomized health-only Worker bound to the same VPC Service to prove the strict VPC path succeeds.
7. Confirm that no public DNS record or public Tunnel route exists for `samson.risencode.org`; update the certificate inventory and runbooks.

Rollback is performed in reverse: return the VPC Service to its prior verification mode only if strict validation prevents service recovery, redeploy the prior Worker hostname, restore the root-only Samson certificate/key pair, and restart the gateway. Keep the production chat feature disabled throughout rollback.

## Open Questions

None for this cutover. Enabling the production canary remains a separate release decision after the broader chatbot verification gates pass.
