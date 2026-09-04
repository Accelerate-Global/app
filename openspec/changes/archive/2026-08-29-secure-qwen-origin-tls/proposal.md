## Why

The private Qwen relay is encrypted but its Workers VPC Service temporarily skips certificate verification because Samson presents a private-CA certificate that Cloudflare does not trust. Replacing that exception with a Cloudflare Origin CA identity for `samson.risencode.org` lets the relay verify both the issuing CA and the exact private origin hostname before the pilot is enabled.

## What Changes

- Issue and install a two-year RSA Cloudflare Origin CA certificate whose only SAN is `samson.risencode.org`; keep its private key on Samson.
- Change the Worker VPC-binding request hostname from `accelerate-qwen-gateway.internal` to `samson.risencode.org` so HTTP `Host` and TLS SNI match the certificate.
- Change the existing VPC Service certificate-verification mode from the temporary disabled exception to `verify_full`.
- Add focused tests and operator documentation for the strict TLS identity, certificate inventory, renewal responsibility, verification, and rollback sequence.
- Do not create a public DNS record or a public route for `samson.risencode.org`; routing remains the single VPC Service to `10.77.0.30:8443` through the existing tunnel.
- Do not change browser access, Cloudflare Access service authentication, application HMAC/replay protection, database permissions, Qwen tools, canary membership, or the production feature flag.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `private-model-gateway`: Require the Cloudflare-to-Samson HTTPS hop to validate a trusted origin certificate and the exact private origin hostname rather than relying on the accepted temporary verification exception.

## Impact

- Worker source and tests: `infra/cloudflare/qwen-edge-gateway/src/index.ts` and `infra/cloudflare/qwen-edge-gateway/src/index.test.ts`.
- Provider/runtime state: the Samson gateway certificate and key, the deployed Cloudflare Worker, and VPC Service `01a04934-2091-7de1-9f7c-6c686698cbd8`.
- Operations documentation: `infra/cloudflare/qwen-edge-gateway/README.md` and `docs/operations/private-data-chat.md`.
- Auth and API contracts remain unchanged: Cloudflare Access and the application HMAC continue to authenticate requests before inference.
- Admin permissions, data integrity, Supabase behavior, Vercel deployment behavior, and UI smoke coverage are unaffected.
