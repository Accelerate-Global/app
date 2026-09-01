# Private Qwen edge gateway

This Worker is the public server-to-server edge for the private Qwen gateway.
Cloudflare Access authenticates the Vercel backend before the Worker runs. The
Worker then uses one least-privilege Workers VPC Service binding to reach only
the Samson gateway at `10.77.0.30:8443` through the dedicated Cloudflare
Tunnel. It never receives a database credential or the application HMAC key.

The Worker accepts only:

- `GET /health`
- `POST /v1/private-data-chat/plan`
- `POST /v1/private-data-chat/answer`

It forwards only the content and `X-AG-*` request-signing headers required by
the Samson gateway. Cloudflare Access credentials, cookies, and arbitrary
headers are never forwarded. Responses are read only after a declared 128 KB
bound is accepted, use an allowlisted header set, and return with
`Cache-Control: no-store`.

## Provider resources

The following resources were provisioned on 2026-08-28 in the selected personal
account (`06281b845d00a5b3857bf215dec00782`) while the
application feature remained disabled:

1. Zero Trust Free plan, Workers subdomain `blake-062.workers.dev`, and Zero
   Trust team `little-feather-aed2`.
2. Remotely managed Tunnel `accelerate-qwen-samson`
   (`3587b7cf-e928-4f57-9e98-d6e74547c0b6`), with its token installed only in
   Samson LXC 105 and a healthy connector.
3. HTTP VPC Service `accelerate-qwen-gateway`
   (`01a04934-2091-7de1-9f7c-6c686698cbd8`) on that tunnel with IPv4
   `10.77.0.30`, HTTPS port `8443`, and no HTTP port.
4. Worker `accelerate-qwen-edge-gateway` at
   `https://accelerate-qwen-edge-gateway.blake-062.workers.dev`, bound only to
   that VPC Service.
5. An all-traffic Cloudflare Access Service Auth policy containing only the
   replacement `Vercel Accelerate Private Qwen` service token.
6. Sensitive Vercel Production variables for the Worker URL and Access token;
   `PRIVATE_DATA_CHAT_ENABLED=false` remained in force during provisioning.

On 2026-08-29 the Samson origin moved to a Cloudflare Origin CA certificate for
its exact configured origin identity and the VPC Service moved to
`verify_full`. The origin still independently requires the body-bound HMAC, a
fresh timestamp, and a one-time nonce. Reverify the certificate identity,
Worker/VPC health, and signed request path after every certificate, service
token, or gateway-contract rotation.

## Local verification

```sh
pnpm run cloudflare:qwen:types
pnpm run cloudflare:qwen:test
pnpm run cloudflare:qwen:dry-run
```

No provider secret belongs in this directory, Wrangler configuration, source,
test fixtures, or logs.
